"""
Content generation routes for SURI.

Retrieves relevant Philippine DepEd SLM content from ChromaDB and calls Gemini
to generate a curriculum-aligned lesson, worked example, and guided explanation.
"""

import os
import uuid
import json
import re
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_student
from backend.database import get_db
from backend.graph import GRAPH
from backend.models.schemas import GenerateContentRequest

import chromadb
import google.generativeai as genai

router = APIRouter(prefix="/api/content", tags=["content"])

# Lazy-loaded global SentenceTransformer model to optimize memory and startup times
_embed_model = None

def get_embed_model():
    """Retrieve or initialize the SentenceTransformer model (singleton pattern)."""
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model


def parse_gemini_json(text: str) -> dict:
    """Clean markdown fences from a string and parse it as JSON."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Match ```json or ``` at start and ``` at end
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
        cleaned = cleaned.strip()
    return json.loads(cleaned)


@router.post("/generate")
async def generate_content(
    body: GenerateContentRequest,
    student=Depends(get_current_student),
):
    """Generate lesson content for a topic node using RAG + Gemini."""
    node_id = body.node_id
    session_id = body.session_id

    if node_id not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node_id: '{node_id}'"
        )

    db = await get_db()
    try:
        # 1. Check content_records table for an existing record with this node_id.
        # If found, return it immediately. Do not regenerate.
        cursor = await db.execute(
            """
            SELECT lesson_text, worked_example, guided_explanation, source_doc, source_chunk_id
            FROM content_records
            WHERE node_id = ?
            """,
            (node_id,),
        )
        row = await cursor.fetchone()
        if row:
            return {
                "node_id": node_id,
                "node_label": GRAPH[node_id]["label"],
                "lesson": row["lesson_text"],
                "worked_example": row["worked_example"],
                "guided_explanation": row["guided_explanation"],
                "source_doc": row["source_doc"],
                "source_chunk_id": row["source_chunk_id"],
            }

        # 2. If not found:
        # a. Load the chromadb PersistentClient from ./knowledge_base/chroma_db
        chroma_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_base", "chroma_db")
        )
        client = chromadb.PersistentClient(path=chroma_path)

        # b. Get the collection "suri_slm"
        try:
            collection = client.get_collection("suri_slm")
        except Exception:
            return {"error": "no_content", "node_id": node_id}

        # c. Generate an embedding for the query:
        # query = f"{GRAPH[node_id]['label']} Grade {GRAPH[node_id]['grade']} mathematics explanation example"
        # Use sentence-transformers all-MiniLM-L6-v2 to embed the query.
        query = f"{GRAPH[node_id]['label']} Grade {GRAPH[node_id]['grade']} mathematics explanation example"
        embed_model = get_embed_model()
        query_embedding = embed_model.encode(query).tolist()

        # d. Query the collection:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=3,
            where={"node_id": node_id}
        )

        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])
        ids = results.get("ids", [])

        # e. If results["documents"] is empty or all empty:
        # Return { error: "no_content", node_id }. Do not call Gemini.
        if not documents or not documents[0] or all(not doc.strip() for doc in documents[0]):
            return {"error": "no_content", "node_id": node_id}

        # f. Concatenate the retrieved chunk texts into a single context string.
        # Record the source document names and chunk IDs from results["metadatas"].
        context_string = "\n\n".join(documents[0])
        
        first_meta = metadatas[0][0] if metadatas and metadatas[0] else {}
        source_doc = first_meta.get("source_doc", "unknown")
        source_chunk_id = ids[0][0] if ids and ids[0] else "unknown"

        # g. Build the Gemini prompt:
        grade = GRAPH[node_id]["grade"]
        prompt = f"""You are a mathematics tutor generating curriculum-aligned lesson content
for Philippine Junior High School students.
Generate content strictly based on the retrieved DepEd SLM content below.
Do not add information not present in the retrieved content.

RETRIEVED CONTENT:
{context_string}

COMPETENCY: {GRAPH[node_id]['label']} (Grade {grade})

Generate the following:
1. LESSON: A clear, simple explanation in 2-3 short paragraphs for a Grade {grade} student.
2. WORKED EXAMPLE: One fully solved example problem. Number each step.
3. GUIDED EXPLANATION: A second example where you explain WHY each step is done.

Return a JSON object with exactly these keys: "lesson", "worked_example", "guided_explanation"
Return only the JSON object. No markdown, no code fences, no extra text."""

        # h. Call Gemini 2.5 Flash with the prompt.
        # Set a 30-second timeout. If it times out, return { error: "generation_timeout", node_id }.
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GEMINI_API_KEY environment variable is missing"
            )
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        try:
            response = await asyncio.wait_for(
                model.generate_content_async(prompt),
                timeout=30.0
            )
            response_text = response.text
        except asyncio.TimeoutError:
            return {"error": "generation_timeout", "node_id": node_id}
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gemini API call failed: {str(ex)}"
            )

        # i. Parse the JSON from Gemini's response text.
        try:
            parsed = parse_gemini_json(response_text)
        except Exception as parse_ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to parse JSON from Gemini response: {str(parse_ex)}. Response was: {response_text}"
            )

        # Normalize keys in parsed JSON in case of minor casing anomalies
        lesson_text = parsed.get("lesson", parsed.get("LESSON", ""))
        worked_example = parsed.get("worked_example", parsed.get("WORKED_EXAMPLE", ""))
        guided_explanation = parsed.get("guided_explanation", parsed.get("GUIDED_EXPLANATION", ""))

        # j. Store in content_records
        record_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """
            INSERT INTO content_records (
                id, node_id, lesson_text, worked_example, guided_explanation,
                source_doc, source_chunk_id, generated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                node_id,
                lesson_text,
                worked_example,
                guided_explanation,
                source_doc,
                source_chunk_id,
                now_iso,
            ),
        )

        # k. Update sessions.last_active_at for the session_id
        await db.execute(
            "UPDATE sessions SET last_active_at = ? WHERE id = ?",
            (now_iso, session_id),
        )
        await db.commit()

        # l. Return the content record mapped to response shape
        return {
            "node_id": node_id,
            "node_label": GRAPH[node_id]["label"],
            "lesson": lesson_text,
            "worked_example": worked_example,
            "guided_explanation": guided_explanation,
            "source_doc": source_doc,
            "source_chunk_id": source_chunk_id,
        }
    finally:
        await db.close()

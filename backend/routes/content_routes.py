"""
Content routes for SURI.

Serves pre-seeded lesson content from the database and generates simplified
lessons on demand when a student needs remediation after practice.
"""

import os
import json
import re
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from backend.auth import get_current_student
from backend.database import get_db
from backend.graph import GRAPH

import google.generativeai as genai

router = APIRouter(prefix="/api/content", tags=["content"])

GEMINI_MODEL = "gemini-3.1-flash-lite"


def parse_gemini_json(text: str) -> dict:
    """Clean markdown fences from a string and parse it as JSON."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
        cleaned = cleaned.strip()
    return json.loads(cleaned)


def _content_row_to_response(node_id: str, row) -> dict:
    return {
        "node_id": node_id,
        "node_label": GRAPH[node_id]["label"],
        "lesson": row["lesson_text"],
        "worked_example": row["worked_example"],
        "guided_explanation": row["guided_explanation"],
        "source_doc": row["source_doc"],
        "simplified_lesson_text": row["simplified_lesson_text"],
    }


def _parse_simplified_payload(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"simplified_lesson_text": raw}


@router.get("/{node_id}")
async def get_content(
    node_id: str,
    student=Depends(get_current_student),
):
    """Return pre-seeded lesson content for a topic node (DB read only)."""
    if node_id not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node_id: '{node_id}'",
        )

    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT lesson_text, worked_example, guided_explanation, source_doc,
                   simplified_lesson_text
            FROM content_records
            WHERE node_id = ?
            """,
            (node_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "no_content", "node_id": node_id},
            )

        return _content_row_to_response(node_id, row)
    finally:
        await db.close()


@router.post("/{node_id}/simplify")
async def simplify_content(
    node_id: str,
    student=Depends(get_current_student),
):
    """Return or generate a simplified lesson after failed practice."""
    if node_id not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node_id: '{node_id}'",
        )

    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT lesson_text, worked_example, guided_explanation,
                   simplified_lesson_text
            FROM content_records
            WHERE node_id = ?
            """,
            (node_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "no_content", "node_id": node_id},
            )

        if row["simplified_lesson_text"]:
            return _parse_simplified_payload(row["simplified_lesson_text"])

        node_label = GRAPH[node_id]["label"]
        lesson_text = json.dumps({
            "lesson": row["lesson_text"],
            "worked_example": row["worked_example"],
            "guided_explanation": row["guided_explanation"],
        })

        prompt = (
            f"The student has already read this lesson on {node_label} and "
            "did not pass the practice. Rewrite the lesson, worked example, "
            "and guided explanation using simpler words, shorter sentences, "
            "and smaller numbers in the examples. Same JSON structure.\n"
            f"Original content: {lesson_text}"
        )

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GEMINI_API_KEY environment variable is missing",
            )

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)

        try:
            response = await asyncio.wait_for(
                model.generate_content_async(prompt),
                timeout=30.0,
            )
            response_text = response.text
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                content={"error": "generation_timeout", "node_id": node_id},
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gemini API call failed: {str(ex)}",
            )

        try:
            parsed = parse_gemini_json(response_text)
        except Exception as parse_ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"Failed to parse JSON from Gemini response: {parse_ex}. "
                    f"Response was: {response_text}"
                ),
            )

        simplified_json = json.dumps(parsed)
        await db.execute(
            """
            UPDATE content_records
            SET simplified_lesson_text = ?
            WHERE node_id = ?
            """,
            (simplified_json, node_id),
        )
        await db.commit()

        return parsed
    finally:
        await db.close()

import os
import sys
import json
import time
import re
import google.generativeai as genai
from dotenv import load_dotenv

# Ensure the parent directory (workspace root) is in the Python path
# so we can import modules from `backend`
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.graph import GRAPH

# Load environment variables
load_dotenv()

# Configure Google Generative AI client
if 'GEMINI_API_KEY' not in os.environ:
    print("ERROR: GEMINI_API_KEY not found in environment variables.")
    exit(1)

genai.configure(api_key=os.environ['GEMINI_API_KEY'])

# ------------------------------------------------------------------
# 1. Check model availability
# ------------------------------------------------------------------
print("Checking model availability...")
try:
    test_model = genai.GenerativeModel('gemini-3.1-flash-lite')
    test_response = test_model.generate_content("Reply with the single word: available")
    print(f"gemini-3.1-flash-lite status: {test_response.text.strip()}")
except Exception as e:
    print(f"gemini-3.1-flash-lite NOT available: {e}")
    print("Update model string before proceeding.")
    exit(1)

# Now import chromadb and sentence_transformers
import chromadb
from sentence_transformers import SentenceTransformer

# Load embedding model
print("Loading embedding model (all-MiniLM-L6-v2)...")
embed_model = SentenceTransformer("all-MiniLM-L6-v2")

# Set up ChromaDB Client
chroma_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "chroma_db"))
print(f"Connecting to ChromaDB at: {chroma_path}")
client = chromadb.PersistentClient(path=chroma_path)

try:
    collection = client.get_collection("suri_slm")
    print("Successfully connected to 'suri_slm' collection.")
except Exception as e:
    print(f"ERROR: Could not retrieve 'suri_slm' collection: {e}")
    exit(1)

# Initialize output dictionary and trackers
output_dict = {}
output_path = os.path.join(os.path.dirname(__file__), "content_seed.json")

# Resume from existing if possible
if os.path.exists(output_path):
    print(f"Found existing {output_path}, loading to resume...")
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            output_dict = json.load(f)
    except Exception as e:
        print(f"Could not load existing file: {e}")

succeeded_nodes = []
skipped_nodes = []

# ------------------------------------------------------------------
# 2. Iterate through GRAPH and generate content
# ------------------------------------------------------------------
for node_id, node_data in GRAPH.items():
    node_label = node_data["label"]
    grade = node_data["grade"]
    print(f"\n--- Processing Node {node_id}: {node_label} (Grade {grade}) ---")

    if node_id in output_dict:
        print(f"Node {node_id} already generated. Skipping.")
        succeeded_nodes.append(node_id)
        continue

    # a. Query ChromaDB collection "suri_slm" for chunks WHERE node_id matches,
    #    n_results=15, using sentence-transformers embedding of:
    #    "{node_label} Grade {grade} mathematics step-by-step operations and examples"
    query_text = f"{node_label} Grade {grade} mathematics step-by-step operations and examples"
    query_vector = embed_model.encode(query_text).tolist()

    try:
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=15,
            where={"node_id": node_id}
        )
    except Exception as e:
        print(f"ERROR querying ChromaDB for {node_id}: {e}")
        skipped_nodes.append(node_id)
        continue

    documents = results.get("documents", [])
    metadatas = results.get("metadatas", [])

    # b. If no chunks found: print a warning and skip this node.
    if not documents or not documents[0] or all(not doc.strip() for doc in documents[0]):
        print(f"WARNING: No chunks found for node {node_id} in ChromaDB. Skipping node.")
        skipped_nodes.append(node_id)
        continue

    # Concatenate context chunks
    context = "\n\n".join(documents[0])

    # c. Build this exact prompt and call gemini-3.1-flash-lite:
    prompt = f"""You are an expert mathematics educator writing an in-depth lesson for Philippine Junior High School students.
    
We are creating content for the competency: {node_label} (Grade {grade}).

Use the provided DepEd SLM content below as your source material. You must focus STRICTLY on the competency "{node_label}". Do not write about other topics that happen to be in the text.

RETRIEVED DEPED CONTENT:
{context}

Write the following components to be engaging, educational, and thorough:

1. LESSON: A comprehensive, in-depth explanation (3 to 5 paragraphs). Teach the concept from scratch. Explain the 'why' and 'how'. Use formatting to make it readable.
2. WORKED_EXAMPLE: One fully solved problem that directly applies to {node_label}. Number every step. Show all work clearly.
3. GUIDED_EXPLANATION: A second different problem. After each step, add one sentence explaining exactly WHY that step is done.

IMPORTANT MATH FORMATTING RULES:
- Inline Math: Wrap expressions in single dollar signs like $x^{{3/4}}$ or $a^2 + b^2 = c^2$.
- Block/Display Math: Wrap expressions in double dollar signs like $$\\frac{{-b \\pm \\sqrt{{b^2-4ac}}}}{{2a}}$$.
- Do not change the normal words, just surround EVERY mathematical equation, variable, or number expression with the appropriate dollar signs.

Return a JSON object with exactly these keys:
"lesson", "worked_example", "guided_explanation"
Return only the JSON. No markdown. No code fences. No extra text.
IMPORTANT: If you use mathematical equations or LaTeX-style formatting with backslashes (e.g., \\frac, \\sqrt, \\theta), you MUST escape every backslash in the JSON string (i.e. use double backslashes like \\\\frac, \\\\sqrt) so that the output is valid, parsable JSON."""

    print(f"Calling gemini-3.1-flash-lite for content generation...")
    try:
        model = genai.GenerativeModel('gemini-3.1-flash-lite')
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # d. Parse the JSON response. Strip any accidental markdown fences.
        cleaned = response_text
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
            cleaned = cleaned.strip()

        try:
            parsed_json = json.loads(cleaned)
        except json.JSONDecodeError as err:
            print(f"Initial JSON decode failed: {err}. Attempting to repair backslashes in math expression...")
            # Escape backslashes not followed by n, ", \, or /
            repaired = re.sub(r'\\(?![n"\\/])', r'\\\\', cleaned)
            try:
                parsed_json = json.loads(repaired)
                print("Repair successful!")
            except json.JSONDecodeError as err2:
                print(f"Repair failed: {err2}")
                # Fallback parsing: look for JSON-like curly braces
                match = re.search(r"(\{.*\})", repaired, re.DOTALL)
                if match:
                    parsed_json = json.loads(match.group(1))
                else:
                    raise

        # Ensure all required keys exist
        required_keys = ["lesson", "worked_example", "guided_explanation"]
        for key in required_keys:
            if key not in parsed_json:
                raise ValueError(f"Missing key '{key}' in Gemini response.")

        # e. Store result in output dict keyed by node_id, including source_doc
        #    We will gather all unique source documents retrieved by the query.
        unique_docs = set()
        if metadatas and metadatas[0]:
            for meta in metadatas[0]:
                if "source_doc" in meta:
                    unique_docs.add(meta["source_doc"])
        source_doc = ", ".join(sorted(unique_docs)) if unique_docs else "unknown"

        output_dict[node_id] = {
            "lesson": parsed_json["lesson"],
            "worked_example": parsed_json["worked_example"],
            "guided_explanation": parsed_json["guided_explanation"],
            "source_doc": source_doc
        }

        print(f"Successfully generated content for {node_id} (Source: {source_doc})")
        succeeded_nodes.append(node_id)

    except Exception as e:
        print(f"ERROR: Failed to process node {node_id} using Gemini: {e}")
        skipped_nodes.append(node_id)

    # f. Sleep 5 seconds between nodes to respect rate limits.
    time.sleep(5)

# ------------------------------------------------------------------
# 3. Write output to content_seed.json
# ------------------------------------------------------------------
print(f"\nWriting final output to {output_path}...")
try:
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_dict, f, indent=2, ensure_ascii=False)
    print("Successfully wrote content_seed.json.")
except Exception as e:
    print(f"ERROR: Failed to write output file: {e}")

# ------------------------------------------------------------------
# 4. Print final summary
# ------------------------------------------------------------------
print("\n" + "=" * 50)
print("FINAL SUMMARY")
print(f"Succeeded nodes ({len(succeeded_nodes)}): {', '.join(succeeded_nodes)}")
print(f"Skipped nodes ({len(skipped_nodes)}): {', '.join(skipped_nodes)}")
print("=" * 50)

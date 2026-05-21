"""
generate_practice.py -- Phase 3B: Practice Problem Bank Generator
=================================================================
Standalone offline script. Never called at runtime.

Generates 10 practice problems per node (150 total) and stores them
in the practice_problems table of the SQLite database.

Flow per expression:
  STEP 1 -- Run mathsteps via subprocess
  STEP 2 -- Call Gemini to generate full problem structure
  STEP 3 -- Validate node IDs and step indices
  STEP 4 -- Insert into practice_problems table

Usage:
  python knowledge_base/generate_practice.py

Estimated runtime: ~15 minutes (150 problems x 5s delay)
"""

import os
import sys
import json
import time
import re
import uuid
import sqlite3
import subprocess
from datetime import datetime, timezone

from google import genai
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Path setup -- ensure the workspace root is importable so we can use backend
# ---------------------------------------------------------------------------
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.graph import GRAPH

# ---------------------------------------------------------------------------
# Environment / config
# ---------------------------------------------------------------------------
load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not found in environment variables.")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "./suri.db")

# Path to mathsteps runner
RUNNER_JS = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "mathsteps_runner", "runner.js")
)

GEMINI_MODEL = "gemini-3.1-flash-lite"

# Valid node IDs for validation
VALID_NODE_IDS = set(GRAPH.keys())

# Flat list for prompt injection
GRAPH_NODE_LIST = ", ".join(sorted(VALID_NODE_IDS))

# ---------------------------------------------------------------------------
# Expression bank -- 10 per node
# ---------------------------------------------------------------------------
NODE_EXPRESSIONS = {
    "FD": [
        "1/2 + 1/4", "3/4 - 1/8", "2/3 * 3/4", "5/6 - 1/3",
        "1/4 + 3/8", "7/8 - 1/2", "3/5 + 1/10", "2/3 - 1/6",
        "3/4 * 2/3", "5/8 + 1/4"
    ],
    "OI": [
        "-3 + 7", "-5 - (-2)", "4 * -3", "-12 / 4", "6 + (-9)",
        "-8 + 3", "(-4) * (-5)", "10 / (-2)", "-7 - 4", "(-3) + (-6)"
    ],
    "LE": [
        "x^2 * x^3", "x^5 / x^2", "(x^2)^3", "x^3 * x^(-1)",
        "(x^3)^2", "x^4 / x^4", "x^2 * x^2 * x", "(x^2 * x^3) / x",
        "x^6 / x^3", "(x^4)^0"
    ],
    "SP": [
        "(x+2)*(x+3)", "(x+1)*(x-1)", "(x+3)^2", "(2x+1)*(x+4)",
        "(x-2)^2", "(x+4)*(x-4)", "(x+5)*(x+2)", "(2x+3)*(x-1)",
        "(x-3)^2", "(x+1)*(x+6)"
    ],
    "FP": [
        "x^2 + 5*x + 6", "x^2 - 4", "2*x^2 + 4*x",
        "x^2 - 9", "x^2 + 7*x + 12", "x^2 - 6*x + 9",
        "3*x^2 + 6*x", "x^2 + 2*x - 8", "x^2 - 16", "x^2 + 4*x + 4"
    ],
    "RPP": [
        "3/4 = x/8", "2/5 = 4/x", "x/3 = 6/9",
        "5/x = 10/14", "1/2 = x/10", "x/6 = 3/9",
        "4/5 = x/25", "2/x = 6/15", "x/4 = 9/12", "3/x = 9/21"
    ],
    "AE": [
        "2*x + 3", "x^2 - x + 1", "3*x - 2*x + 5",
        "4*(x+2)", "x + 2*x + 3*x", "5*x - 3 + 2*x",
        "x^2 + 2*x", "3*(x+1) + 2", "2*x^2 - x", "4*x + x - 2"
    ],
    "L1V": [
        "2*x + 3 = 7", "x - 4 = 10", "3*x = 15",
        "x/2 = 6", "5*x - 2 = 13", "4*x + 1 = 17",
        "x + 8 = 15", "2*x - 5 = 9", "3*x + 4 = 19", "x/3 = 4"
    ],
    "L2V": [
        "y = 2*x + 1", "2*x + y = 10", "y - x = 3",
        "3*x - y = 6", "x + 2*y = 8", "y = -x + 5",
        "4*x - y = 7", "2*x + 3*y = 12", "y = 3*x - 2", "x - y = 4"
    ],
    "SLE": [
        "2*x + y = 10, x - y = 2", "x + y = 5, x - y = 1",
        "3*x + 2*y = 12, x + y = 5", "x + 2*y = 8, x - y = 2",
        "2*x - y = 3, x + y = 6", "3*x + y = 9, x + y = 5",
        "x + y = 7, 2*x - y = 5", "4*x + y = 11, x + y = 5",
        "2*x + 3*y = 13, x + y = 5", "x + 3*y = 10, x + y = 4"
    ],
    "RER": [
        "sqrt(16)", "sqrt(x^2)", "x^(1/2) * x^(1/2)",
        "27^(1/3)", "sqrt(9*x^2)", "x^(3/2)", "4^(1/2)",
        "8^(2/3)", "sqrt(25*x^4)", "x^(2/3) * x^(1/3)"
    ],
    "PO": [
        "(x^2 + 2*x) + (x^2 - x)", "(3*x^2 + x) - (x^2 + 2*x)",
        "2*(x^2 + 3*x)", "(x^2)(x+1)", "x*(x^2 - x + 1)",
        "(2*x^2 + x) + (x^2 - 3*x)", "(x^3 + x^2) - x^2",
        "3*x*(x + 2)", "(x^2 + 4*x) - (2*x^2 - x)",
        "x^2*(x - 1)"
    ],
    "PD": [
        "(x^2 + 3*x + 2) / (x + 1)", "(x^2 - 4) / (x - 2)",
        "(x^3 - x^2) / x", "(x^2 + 5*x + 6) / (x + 2)",
        "(x^2 - 9) / (x - 3)", "(x^3 + x^2) / x^2",
        "(x^2 - x - 6) / (x + 2)", "(x^2 + 4*x + 4) / (x + 2)",
        "(x^3 - 8) / (x - 2)", "(x^2 - 16) / (x + 4)"
    ],
    "QE": [
        "x^2 + 5*x + 6 = 0", "x^2 - 4 = 0",
        "x^2 - 3*x + 2 = 0", "2*x^2 + 4*x = 0",
        "x^2 - x - 6 = 0", "x^2 + 6*x + 9 = 0",
        "x^2 - 5*x + 6 = 0", "x^2 - 1 = 0",
        "x^2 + 3*x - 10 = 0", "x^2 - 7*x + 12 = 0"
    ],
    "PE": [
        "x^3 - x = 0", "x^3 - 4*x = 0",
        "x^2*(x-1) = 0", "x^3 - x^2 = 0",
        "x^3 + x^2 - 2*x = 0", "x^3 - 9*x = 0",
        "x^2*(x+2) = 0", "x^3 - 4*x^2 = 0",
        "x*(x^2 - 5*x + 6) = 0", "x^3 - x^2 - x + 1 = 0"
    ],
}


# ---------------------------------------------------------------------------
# STEP 1 -- Run mathsteps
# ---------------------------------------------------------------------------
def run_mathsteps(expression: str) -> list:
    """
    Call runner.js via subprocess with the expression.
    Returns a list of {step_index, from, to, rule} dicts.
    Returns empty list if mathsteps errors or returns nothing.
    """
    try:
        result = subprocess.run(
            ["node", RUNNER_JS, expression],
            capture_output=True,
            text=True,
            timeout=15
        )
        stdout = result.stdout.strip()
        if not stdout:
            return []
        parsed = json.loads(stdout)
        if isinstance(parsed, dict) and "error" in parsed:
            return []
        if isinstance(parsed, list):
            return parsed
        return []
    except Exception as e:
        print(f"    [mathsteps] Error: {e}")
        return []


# ---------------------------------------------------------------------------
# STEP 2 -- Call Gemini
# ---------------------------------------------------------------------------
def parse_gemini_json(raw_text: str) -> dict:
    """
    Robustly parse Gemini's JSON response, handling markdown fences
    and unescaped backslashes in LaTeX expressions.
    """
    cleaned = raw_text.strip()

    # Strip markdown code fences
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    # Attempt 1: direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Attempt 2: repair unescaped backslashes (e.g. \frac -> \\frac)
    repaired = re.sub(r'\\(?![n"\\/brtu])', r'\\\\', cleaned)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Attempt 3: extract outermost JSON object
    match = re.search(r"(\{.*\})", repaired, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not parse Gemini response as JSON.")


def call_gemini(
    client: genai.Client,
    node_id: str,
    node_label: str,
    grade: int,
    expression: str,
    mathsteps_json: str,
) -> dict:
    """
    Build the exact prompt and call Gemini. Returns parsed dict with keys:
    word_problem, variable_identification, solution_steps, all_steps
    """
    prompt = (
        f"You are generating a complete practice problem for a Philippine JHS "
        f"student practicing: {node_label} (Grade {grade})\n\n"
        f"EXPRESSION: {expression}\n\n"
        f"MATHSTEPS OUTPUT (may be empty):\n{mathsteps_json}\n\n"
        f"Generate a complete problem object with these exact fields:\n\n"
        f"word_problem: A 2-3 sentence real-world scenario whose solution requires "
        f"solving the expression above. Use Filipino-relatable context "
        f"(sari-sari store, jeepney fare, school supplies, etc). "
        f"Make it appropriate for Grade {grade}.\n\n"
        f"variable_identification: A JSON array of 1-2 steps. Each step has:\n"
        f"  - step_index: integer starting at 0\n"
        f"  - type: \"variable_id\"\n"
        f"  - instruction: tell the student what to identify or write\n"
        f"  - blank_expression: the partial equation with ___ for blanks\n"
        f"  - correct_value: exact string student must type\n"
        f"  - operation_description: \"Identify the variable\" or \"Write the equation\"\n"
        f"  - mapped_node_id: {node_id}\n\n"
        f"solution_steps: A JSON array of the full algebraic solution steps. "
        f"Each step has:\n"
        f"  - step_index: integer (continuing from variable_identification)\n"
        f"  - type: \"algebra\"\n"
        f"  - instruction: short imperative (e.g. \"Factor the left side\")\n"
        f"  - blank_expression: the expression at this step with the key computed "
        f"part replaced by ___. Show enough context so the student knows where "
        f"they are in the solution.\n"
        f"  - correct_value: exact string the student must type to fill the blank\n"
        f"  - operation_description: brief label for the operation\n"
        f"  - mapped_node_id: the node_id this step most directly tests. "
        f"Only use valid node_ids from this list: {GRAPH_NODE_LIST}\n\n"
        f"all_steps: a single JSON array combining variable_identification steps "
        f"first, then solution_steps, with step_index continuous from 0.\n\n"
        f"Return a single JSON object with keys:\n"
        f"\"word_problem\", \"variable_identification\", \"solution_steps\", \"all_steps\"\n"
        f"Return only the JSON. No markdown. No code fences.\n"
        f"IMPORTANT: If you use mathematical equations or LaTeX-style formatting "
        f"with backslashes (e.g., \\\\frac, \\\\sqrt), you MUST escape every backslash "
        f"in the JSON string (i.e. use double backslashes like \\\\\\\\frac, \\\\\\\\sqrt) "
        f"so that the output is valid, parsable JSON."
    )

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )
    return parse_gemini_json(response.text)


# ---------------------------------------------------------------------------
# STEP 3 -- Validate
# ---------------------------------------------------------------------------
def validate_and_fix(data: dict, node_id: str) -> dict:
    """
    Validate the Gemini response:
    - Replace invalid mapped_node_ids with node_id
    - Ensure all_steps step_index is sequential from 0
    - Ensure correct_value is never empty
    """
    all_steps = data.get("all_steps", [])

    for i, step in enumerate(all_steps):
        # Fix step_index to be sequential
        step["step_index"] = i

        # Fix invalid node IDs
        mid = step.get("mapped_node_id", "")
        if mid not in VALID_NODE_IDS:
            step["mapped_node_id"] = node_id

        # Fix empty correct_value
        if not step.get("correct_value", "").strip():
            step["correct_value"] = "?"

    data["all_steps"] = all_steps
    return data


# ---------------------------------------------------------------------------
# STEP 4 -- Store in SQLite
# ---------------------------------------------------------------------------
def get_db_connection() -> sqlite3.Connection:
    """Return a synchronous SQLite connection."""
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_table_exists(conn: sqlite3.Connection):
    """Ensure practice_problems table exists (idempotent)."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS practice_problems (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            problem_expr TEXT NOT NULL,
            steps_json TEXT NOT NULL,
            word_problem_text TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()


def problem_exists(conn: sqlite3.Connection, node_id: str, expression: str) -> bool:
    """Check if a problem for (node_id, expression) already exists -- for resume support."""
    cursor = conn.execute(
        "SELECT id FROM practice_problems WHERE node_id = ? AND problem_expr = ?",
        (node_id, expression)
    )
    return cursor.fetchone() is not None


def insert_problem(
    conn: sqlite3.Connection,
    node_id: str,
    expression: str,
    word_problem_text: str,
    all_steps: list
):
    """Insert a single practice problem row."""
    conn.execute(
        """
        INSERT INTO practice_problems (id, node_id, problem_expr, steps_json, word_problem_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            node_id,
            expression,
            json.dumps(all_steps, ensure_ascii=False),
            word_problem_text,
            datetime.now(timezone.utc).isoformat()
        )
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("SURI Phase 3B -- Practice Problem Bank Generator")
    print("=" * 60)
    print(f"Database : {DATABASE_URL}")
    print(f"Model    : {GEMINI_MODEL}")
    print(f"Runner   : {RUNNER_JS}")
    print()

    # --- Configure Gemini (new SDK) ---
    client = genai.Client(api_key=GEMINI_API_KEY)

    print("Checking Gemini model availability...")
    try:
        test_response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents="Reply with the single word: available"
        )
        status_text = test_response.text.strip() if test_response.text else "(no text)"
        print(f"  {GEMINI_MODEL} status: {status_text}")
    except Exception as e:
        print(f"  ERROR: {GEMINI_MODEL} not available: {e}")
        print("  Update GEMINI_MODEL before proceeding.")
        sys.exit(1)

    # --- Connect to DB ---
    conn = get_db_connection()
    ensure_table_exists(conn)

    total_stored = 0
    total_failed = 0
    total_skipped = 0

    total_problems = sum(len(exprs) for exprs in NODE_EXPRESSIONS.values())
    problem_num = 0

    for node_id, expressions in NODE_EXPRESSIONS.items():
        node_data = GRAPH.get(node_id, {})
        node_label = node_data.get("label", node_id)
        grade = node_data.get("grade", 7)

        print()
        print("-" * 60)
        print(f"Node {node_id}: {node_label}  (Grade {grade})")
        print("-" * 60)

        for expr_idx, expression in enumerate(expressions):
            problem_num += 1
            print(f"\n  [{problem_num}/{total_problems}] {node_id} | {expression}")

            # Resume: skip if already in DB
            if problem_exists(conn, node_id, expression):
                print("    [SKIP] Already in DB.")
                total_skipped += 1
                continue

            # ----------------------------------------------------------
            # STEP 1 -- Run mathsteps
            # ----------------------------------------------------------
            print("    -> Running mathsteps...")
            mathsteps_result = run_mathsteps(expression)
            mathsteps_json = json.dumps(mathsteps_result, ensure_ascii=False)
            if mathsteps_result:
                print(f"    [OK] mathsteps returned {len(mathsteps_result)} step(s).")
            else:
                print("    [WARN] mathsteps returned empty/error -- Gemini will generate steps.")

            # ----------------------------------------------------------
            # STEP 2 -- Call Gemini
            # ----------------------------------------------------------
            print(f"    -> Calling Gemini ({GEMINI_MODEL})...")
            try:
                raw_data = call_gemini(
                    client=client,
                    node_id=node_id,
                    node_label=node_label,
                    grade=grade,
                    expression=expression,
                    mathsteps_json=mathsteps_json,
                )
            except Exception as e:
                print(f"    [FAIL] Gemini call failed: {e}")
                total_failed += 1
                time.sleep(5)
                continue

            # ----------------------------------------------------------
            # STEP 3 -- Validate
            # ----------------------------------------------------------
            try:
                validated = validate_and_fix(raw_data, node_id)
                word_problem = validated.get("word_problem", "")
                all_steps = validated.get("all_steps", [])

                if not word_problem:
                    raise ValueError("Missing word_problem in response.")
                if not all_steps:
                    raise ValueError("Missing all_steps in response.")
            except Exception as e:
                print(f"    [FAIL] Validation failed: {e}")
                total_failed += 1
                time.sleep(5)
                continue

            # ----------------------------------------------------------
            # STEP 4 -- Store in SQLite
            # ----------------------------------------------------------
            try:
                insert_problem(
                    conn=conn,
                    node_id=node_id,
                    expression=expression,
                    word_problem_text=word_problem,
                    all_steps=all_steps
                )
                print(f"    [OK] Stored. ({len(all_steps)} steps)")
                total_stored += 1
            except Exception as e:
                print(f"    [FAIL] DB insert failed: {e}")
                total_failed += 1
                time.sleep(5)
                continue

            # Rate limit guard between Gemini calls (10s = ~6 RPM, safe under 15 RPM limit)
            time.sleep(10)

    # --- Final summary ---
    conn.close()

    print()
    print("=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"  Total stored  : {total_stored}")
    print(f"  Total skipped : {total_skipped}  (already existed in DB)")
    print(f"  Total failed  : {total_failed}")
    print(f"  Grand total   : {total_stored + total_skipped + total_failed} / {total_problems}")
    print("=" * 60)

    # Quick verification query
    conn2 = get_db_connection()
    cursor = conn2.execute("SELECT COUNT(*) FROM practice_problems")
    row_count = cursor.fetchone()[0]
    conn2.close()
    print(f"\n  practice_problems table now has {row_count} row(s).")

    if row_count >= total_problems:
        print("  [DONE] All problems generated successfully!")
    else:
        missing = total_problems - row_count
        print(f"  [WARN] {missing} problem(s) still missing. Re-run to resume.")


if __name__ == "__main__":
    main()

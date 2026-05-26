"""
generate_distractors.py -- Quiz Mode: Distractor & Hint Generator
=================================================================
Standalone offline script. Never called at runtime.

Reads ALL existing rows from practice_problems, and for each step in
steps_json that does NOT already have extras, calls Gemini to generate:
  - 3 plausible wrong answer choices (distractors)
  - 1 short hint string

Stores results in the step_extras_json column (added by migrate_quiz_tables.py).

Resume-safe: skips problems that already have step_extras_json populated.

Usage:
  python knowledge_base/generate_distractors.py

Estimated runtime: ~1 minute per 10 problems (rate-limited to ~6 RPM)
"""

import os
import sys
import json
import time
import re
import asyncio
import asyncpg

import google.generativeai as genai
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not found.")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "./suri.db")
GEMINI_MODEL = "gemini-3.1-flash-lite"

HINT_COST = 1500  # documented constant, not enforced here


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
async def get_db_pool() -> asyncpg.Pool:
    pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=1,
        max_size=5,
        statement_cache_size=0,
    )
    return pool


async def ensure_column_exists(conn: asyncpg.Connection):
    """Add step_extras_json column if it doesn't exist yet."""
    row = await conn.fetchrow(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='practice_problems' AND column_name='step_extras_json'"
    )
    if not row:
        await conn.execute("ALTER TABLE practice_problems ADD COLUMN step_extras_json TEXT DEFAULT NULL")
        print("  [MIGRATE] Added step_extras_json column to practice_problems.")


# ---------------------------------------------------------------------------
# Gemini call
# ---------------------------------------------------------------------------
def parse_json_robust(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        repaired = re.sub(r'\\(?![n"\\/brtu])', r'\\\\', cleaned)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass
        match = re.search(r"(\{.*\})", repaired, re.DOTALL)
        if match:
            return json.loads(match.group(1))
    raise ValueError("Could not parse Gemini response as JSON.")


def call_gemini_for_step(
    model: genai.GenerativeModel,
    step: dict,
    problem_expr: str,
    word_problem_text: str,
) -> dict:
    """
    For one step, ask Gemini to produce:
      - distractors: list of 3 plausible wrong answers
      - hint: a short 1-2 sentence hint string

    Returns {"distractors": [...], "hint": "..."}
    """
    correct_value = step.get("correct_value", "")
    instruction = step.get("instruction", "")
    blank_expression = step.get("blank_expression", "")
    step_type = step.get("step_type", "algebra")
    operation_description = step.get("operation_description", "")

    prompt = (
        f"You are generating quiz data for a Philippine JHS math practice system.\n\n"
        f"PROBLEM EXPRESSION: {problem_expr}\n"
        f"WORD PROBLEM: {word_problem_text}\n\n"
        f"STEP TYPE: {step_type}\n"
        f"INSTRUCTION TO STUDENT: {instruction}\n"
        f"BLANK EXPRESSION: {blank_expression}\n"
        f"CORRECT ANSWER: {correct_value}\n"
        f"OPERATION: {operation_description}\n\n"
        f"TASK:\n"
        f"1. Generate exactly 3 WRONG but PLAUSIBLE answer choices (distractors) for this step.\n"
        f"   - They must look like realistic student mistakes (sign errors, wrong operation, off-by-one, etc.)\n"
        f"   - They must NOT equal the correct answer: {correct_value}\n"
        f"   - Keep them short — the same format as the correct answer\n"
        f"2. Generate a 1-2 sentence HINT that helps the student figure out the answer without giving it away.\n"
        f"   - The hint should reference the concept being tested ({operation_description})\n"
        f"   - Do NOT include the correct answer in the hint\n\n"
        f"Return ONLY a JSON object with exactly these two keys:\n"
        f"{{\"distractors\": [\"wrong1\", \"wrong2\", \"wrong3\"], \"hint\": \"hint text here\"}}\n"
        f"No markdown, no code fences, no other text."
    )

    response = model.generate_content(prompt)
    return parse_json_robust(response.text)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def async_main():
    print("=" * 60, flush=True)
    print("SURI Quiz Mode -- Distractor & Hint Generator (PostgreSQL)", flush=True)
    print("=" * 60, flush=True)
    print(f"Database : {DATABASE_URL}", flush=True)
    print(f"Model    : {GEMINI_MODEL}\n", flush=True)

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    # Quick availability check
    print("Checking Gemini availability...")
    try:
        test = model.generate_content("Reply: available")
        print(f"  Status: {test.text.strip()}")
    except Exception as e:
        print(f"  ERROR: {e}")
        sys.exit(1)

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await ensure_column_exists(conn)

        rows = await conn.fetch(
            "SELECT id, node_id, problem_expr, steps_json, word_problem_text, step_extras_json FROM practice_problems"
        )

        total = len(rows)
        skipped = 0
        processed = 0
        failed = 0

        print(f"\nFound {total} practice problems.\n", flush=True)

        for i, row in enumerate(rows):
            problem_id = row["id"]
            problem_expr = row["problem_expr"]
            word_problem_text = row["word_problem_text"] or ""
            existing_extras = row["step_extras_json"]

            # Resume support: skip if already generated
            if existing_extras:
                print(f"  [{i+1}/{total}] SKIP {problem_id[:8]}... (already has extras)", flush=True)
                skipped += 1
                continue

            print(f"\n  [{i+1}/{total}] Processing {problem_id[:8]}... | {problem_expr}", flush=True)

            try:
                steps = json.loads(row["steps_json"])
            except Exception as e:
                print(f"    [FAIL] Could not parse steps_json: {e}")
                failed += 1
                continue

            # Normalize step_type key (legacy: "type" vs "step_type")
            normalized_steps = []
            for s in steps:
                d = dict(s)
                if "step_type" not in d and "type" in d:
                    d["step_type"] = d.pop("type")
                normalized_steps.append(d)

            step_extras = {}
            problem_failed = False

            for step in normalized_steps:
                step_index = step.get("step_index", 0)
                correct_value = step.get("correct_value", "")

                print(f"    -> Step {step_index}: correct_value='{correct_value}'")

                try:
                    result = call_gemini_for_step(
                        model=model,
                        step=step,
                        problem_expr=problem_expr,
                        word_problem_text=word_problem_text,
                    )

                    distractors = result.get("distractors", [])
                    hint = result.get("hint", "")

                    # Validate: must have exactly 3 distractors, none equal to correct
                    if len(distractors) != 3:
                        raise ValueError(f"Expected 3 distractors, got {len(distractors)}")

                    # Filter out any distractor that equals the correct value
                    distractors = [d for d in distractors if d.strip() != correct_value.strip()]
                    while len(distractors) < 3:
                        distractors.append(f"~{correct_value}")  # fallback placeholder

                    step_extras[str(step_index)] = {
                        "distractors": distractors[:3],
                        "hint": hint,
                    }

                    print(f"       [OK] distractors={distractors[:3]}", flush=True)

                except Exception as e:
                    print(f"       [FAIL] Gemini call failed for step {step_index}: {e}", flush=True)
                    # Use placeholder extras so the problem isn't entirely broken
                    step_extras[str(step_index)] = {
                        "distractors": [f"~{correct_value}", "N/A", "Cannot determine"],
                        "hint": f"Think about the operation: {step.get('operation_description', 'solve this step')}.",
                    }
                    problem_failed = True

                # Rate limit between steps
                await asyncio.sleep(6)

            # Store back into DB
            try:
                await conn.execute(
                    "UPDATE practice_problems SET step_extras_json = $1 WHERE id = $2",
                    json.dumps(step_extras, ensure_ascii=False), problem_id
                )
                status = "[PARTIAL]" if problem_failed else "[OK]"
                print(f"    {status} Stored step_extras for {len(step_extras)} steps.", flush=True)
                processed += 1
            except Exception as e:
                print(f"    [FAIL] DB update failed: {e}", flush=True)
                failed += 1

            # Rate limit between problems
            await asyncio.sleep(5)

    await pool.close()

    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Processed : {processed}")
    print(f"  Skipped   : {skipped}  (already had extras)")
    print(f"  Failed    : {failed}")
    print("=" * 60)


if __name__ == "__main__":
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)
    asyncio.run(async_main())

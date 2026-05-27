"""
generate_distractors.py -- Quiz Mode: Distractor & Hint Generator
=================================================================
Standalone offline script. Never called at runtime.

Reads ALL existing rows from practice_problems, and for each PROBLEM
(not each step) calls Gemini ONCE to generate, for every step:
  - 3 plausible wrong answer choices (distractors)
  - 1 short hint string

This reduces API usage from ~(steps × problems) calls down to
~problems calls (~156 instead of ~624).

Stores results in the step_extras_json column (added by migrate_quiz_tables.py).

Resume-safe: skips problems that already have step_extras_json populated.

Usage:
  python knowledge_base/generate_distractors.py
"""

import os
import sys
import json
import re
import asyncio
import asyncpg

import google.genai as genai
from google.genai import types as genai_types
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

# Seconds to wait between API calls (keep under 10 RPM for free tier)
RATE_LIMIT_SLEEP = 7


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
# Fallback: numeric distractor generation (no API needed)
# ---------------------------------------------------------------------------
def _try_numeric(value: str):
    """Try to parse a value as float. Returns float or None."""
    try:
        return float(value.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def generate_fallback_distractors(correct_value: str) -> list[str]:
    """
    Generate 3 plausible numeric distractors from the correct answer
    without calling the API. Used when the API call fails.
    """
    num = _try_numeric(correct_value)
    if num is not None:
        # Produce offsets that look like common student errors
        candidates = set()
        for delta in [1, -1, 2, -2, 0.5, -0.5, num * 0.1, -(num * 0.1)]:
            v = num + delta
            # Format as int if whole number
            candidates.add(str(int(v)) if v == int(v) else f"{v:.2f}".rstrip("0").rstrip("."))
        candidates.discard(correct_value.strip())
        result = list(candidates)[:3]
        while len(result) < 3:
            result.append(str(int(num) + len(result) + 1))
        return result

    # Non-numeric fallback: safe generic placeholders
    # (the API will generate real ones; this is only used if the call fails)
    stripped = correct_value.strip()
    return [f"Not {stripped}", f"More than {stripped}", f"Less than {stripped}"]


# ---------------------------------------------------------------------------
# Gemini: one call per problem covering ALL its steps
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


def call_gemini_for_problem(
    client: genai.Client,
    steps: list[dict],
    problem_expr: str,
    word_problem_text: str,
) -> dict:
    """
    Send ONE prompt for an entire problem covering ALL steps.

    Returns a dict keyed by step_index (as string):
      { "0": {"distractors": [...], "hint": "..."}, "1": {...}, ... }
    """
    steps_block = ""
    for s in steps:
        idx = s.get("step_index", 0)
        steps_block += (
            f"\n--- STEP {idx} ---\n"
            f"Instruction: {s.get('instruction', '')}\n"
            f"Blank expression: {s.get('blank_expression', '')}\n"
            f"Correct answer: {s.get('correct_value', '')}\n"
            f"Operation: {s.get('operation_description', '')}\n"
            f"Step type: {s.get('step_type', 'algebra')}\n"
        )

    step_indices = [str(s.get("step_index", i)) for i, s in enumerate(steps)]
    expected_keys = ", ".join(f'"{k}"' for k in step_indices)

    prompt = (
        f"You are generating quiz data for a Philippine JHS math practice system.\n\n"
        f"PROBLEM EXPRESSION: {problem_expr}\n"
        f"WORD PROBLEM: {word_problem_text}\n"
        f"\nThis problem has {len(steps)} step(s):\n"
        f"{steps_block}\n"
        f"TASK: For EACH step above, generate:\n"
        f"1. Exactly 3 WRONG but PLAUSIBLE answer choices (distractors).\n"
        f"   - Must look like realistic student mistakes (sign error, wrong operation, off-by-one, etc.)\n"
        f"   - Must NOT equal the correct answer for that step.\n"
        f"   - Must be in the SAME format as the correct answer (e.g., a number, a LaTeX expression).\n"
        f"   - Must NOT be vague phrases like 'N/A', 'Cannot be determined', 'Not possible', etc.\n"
        f"2. A 1–2 sentence HINT that helps the student without giving away the answer.\n"
        f"   - Reference the concept/operation for that step.\n"
        f"   - Do NOT include the correct answer in the hint.\n\n"
        f"Return ONLY a single JSON object keyed by step index ({expected_keys}), like:\n"
        f"{{\n"
        f'  "0": {{"distractors": ["wrong1", "wrong2", "wrong3"], "hint": "hint text"}},\n'
        f'  "1": {{"distractors": ["wrong1", "wrong2", "wrong3"], "hint": "hint text"}}\n'
        f"}}\n"
        f"No markdown, no code fences, no other text outside the JSON."
    )

    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return parse_json_robust(response.text)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
INVALID_PHRASES = {
    "n/a", "na", "cannot be determined", "cannot determine", "not possible",
    "undefined", "none", "not applicable", "indeterminate",
    "cannot determine", "unknown", "error", "invalid", "does not exist",
}


def has_invalid_distractors(step_extras_json_str: str) -> bool:
    """
    Returns True if any distractor in the stored step_extras_json
    is a known invalid phrase (N/A, Cannot determine, etc.).
    These records need to be regenerated.
    """
    try:
        extras = json.loads(step_extras_json_str)
    except (json.JSONDecodeError, TypeError):
        return True  # Corrupt JSON → regenerate

    for step_data in extras.values():
        for distractor in step_data.get("distractors", []):
            if distractor.strip().lower() in INVALID_PHRASES:
                return True
    return False


def is_valid_distractor(d: str, correct_value: str) -> bool:
    """Return True if distractor is a usable answer choice."""
    cleaned = d.strip().lower()
    if cleaned == correct_value.strip().lower():
        return False
    if cleaned in INVALID_PHRASES:
        return False
    if len(cleaned) == 0:
        return False
    return True


def sanitize_step_extras(step_extras: dict, steps_by_index: dict) -> dict:
    """
    For each step, ensure exactly 3 valid distractors.
    Replace invalid ones with computed numeric fallbacks.
    """
    out = {}
    for idx_str, extras in step_extras.items():
        correct = steps_by_index.get(int(idx_str), {}).get("correct_value", "")
        raw_distractors = extras.get("distractors", [])
        valid = [d for d in raw_distractors if is_valid_distractor(d, correct)]

        if len(valid) < 3:
            fallbacks = generate_fallback_distractors(correct)
            for fb in fallbacks:
                if is_valid_distractor(fb, correct) and fb not in valid:
                    valid.append(fb)
                if len(valid) >= 3:
                    break

        out[idx_str] = {
            "distractors": valid[:3],
            "hint": extras.get("hint", f"Think about how to apply the operation for this step."),
        }
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def async_main():
    print("=" * 60, flush=True)
    print("SURI Quiz Mode -- Distractor & Hint Generator (per-problem)", flush=True)
    print("=" * 60, flush=True)
    print(f"Database : {DATABASE_URL}", flush=True)
    print(f"Model    : {GEMINI_MODEL}\n", flush=True)

    client = genai.Client(api_key=GEMINI_API_KEY)

    # Quick availability check
    print("Checking Gemini availability...")
    try:
        test = client.models.generate_content(
            model=GEMINI_MODEL,
            contents="Reply: available"
        )
        print(f"  Status: {test.text.strip()}")
    except Exception as e:
        print(f"  ERROR: {e}")
        sys.exit(1)

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await ensure_column_exists(conn)

        rows = await conn.fetch(
            "SELECT id, node_id, problem_expr, steps_json, word_problem_text, step_extras_json "
            "FROM practice_problems"
        )

        total = len(rows)
        skipped = 0
        processed = 0
        regenerated = 0
        failed = 0

        print(f"\nFound {total} practice problems.\n", flush=True)

        for i, row in enumerate(rows):
            problem_id = row["id"]
            problem_expr = row["problem_expr"]
            word_problem_text = row["word_problem_text"] or ""
            existing_extras = row["step_extras_json"]

            # Resume support: skip if already generated AND valid
            needs_regen = False
            if existing_extras:
                if has_invalid_distractors(existing_extras):
                    print(f"  [{i+1}/{total}] REGEN {problem_id[:8]}... (has invalid distractors, regenerating)", flush=True)
                    needs_regen = True
                    # Fall through to regenerate
                else:
                    print(f"  [{i+1}/{total}] SKIP  {problem_id[:8]}... (already has valid extras)", flush=True)
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

            steps_by_index = {s.get("step_index", idx): s for idx, s in enumerate(normalized_steps)}

            # ONE Gemini call for the entire problem
            try:
                raw_result = call_gemini_for_problem(
                    client=client,
                    steps=normalized_steps,
                    problem_expr=problem_expr,
                    word_problem_text=word_problem_text,
                )

                # Ensure keys are strings
                raw_result = {str(k): v for k, v in raw_result.items()}

                # Fill any missing step indices with fallbacks
                for s in normalized_steps:
                    idx_str = str(s.get("step_index", 0))
                    if idx_str not in raw_result:
                        print(f"    [WARN] Step {idx_str} missing from Gemini response, using fallback.", flush=True)
                        raw_result[idx_str] = {
                            "distractors": generate_fallback_distractors(s.get("correct_value", "0")),
                            "hint": f"Think about: {s.get('operation_description', 'this step')}.",
                        }

                step_extras = sanitize_step_extras(raw_result, steps_by_index)
                problem_failed = False
                print(f"    [OK] Generated extras for {len(step_extras)} steps.", flush=True)
                for idx_str, extras in step_extras.items():
                    print(f"       Step {idx_str}: distractors={extras['distractors']}", flush=True)

            except Exception as e:
                print(f"    [FAIL] Gemini call failed: {e}", flush=True)
                # Build fallback extras for all steps without calling API again
                step_extras = {}
                for s in normalized_steps:
                    idx_str = str(s.get("step_index", 0))
                    correct = s.get("correct_value", "0")
                    step_extras[idx_str] = {
                        "distractors": generate_fallback_distractors(correct),
                        "hint": f"Think about how to apply: {s.get('operation_description', 'this step')}.",
                    }
                problem_failed = True

            # Store back into DB
            try:
                await conn.execute(
                    "UPDATE practice_problems SET step_extras_json = $1 WHERE id = $2",
                    json.dumps(step_extras, ensure_ascii=False), problem_id
                )
                status = "[PARTIAL/FALLBACK]" if problem_failed else "[OK]"
                print(f"    {status} Stored step_extras for {len(step_extras)} steps.", flush=True)
                processed += 1
                if needs_regen:
                    regenerated += 1
            except Exception as e:
                print(f"    [FAIL] DB update failed: {e}", flush=True)
                failed += 1

            # Rate limit between problems (one call per problem now)
            await asyncio.sleep(RATE_LIMIT_SLEEP)

    await pool.close()

    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total problems : {total}")
    print(f"  Processed      : {processed}  (new + regenerated)")
    print(f"    - Regenerated: {regenerated}  (had invalid distractors)")
    print(f"    - New        : {processed - regenerated}")
    print(f"  Skipped        : {skipped}  (already had valid extras)")
    print(f"  Failed         : {failed}")
    print(f"  API calls made : ~{processed}  (1 per problem)")
    print("=" * 60)


if __name__ == "__main__":
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)
    asyncio.run(async_main())

"""
Quiz routes for SURI — Quizizz-style gamified practice mode.

Flow:
  POST /api/quiz/start         → creates quiz_session, returns problems+choices+timers
  POST /api/quiz/submit-step   → evaluates one step, returns correct/points (no AI)
  POST /api/quiz/skip-step     → reveals correct answer, advances step (no penalty)
  POST /api/quiz/use-hint      → deducts 1500 pts, returns pre-generated hint text
  POST /api/quiz/finish        → generates aggregated AI feedback once, runs progression
"""

import json
import uuid
import os
import re
import random
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_student
from backend.database import get_db, release_db
from backend.graph import GRAPH
from backend.competency_utils import (
    upsert_status,
    mark_prerequisites_mastered,
    find_next_upward,
    get_status,
    get_chain,
)
from backend.progress_utils import compute_and_save_session_progress
from backend.models.schemas import (
    QuizStartRequest,
    QuizStartResponse,
    QuizSubmitStepRequest,
    QuizSubmitStepResponse,
    QuizSkipStepRequest,
    QuizSkipStepResponse,
    QuizUseHintRequest,
    QuizUseHintResponse,
    QuizFinishRequest,
    QuizFinishResponse,
)

import google.generativeai as genai

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

# ── Constants ────────────────────────────────────────────────────────────────
PRACTICE_SET_SIZE = 5
PASS_THRESHOLD = 3          # must pass ≥ 3 problems to advance
BASE_POINTS = 500          # max points for fastest correct answer
MIN_POINTS = 100            # floor for any correct answer

# Timer durations returned to frontend (ms)
TIMER_MS = {
    "variable_identification": 20_000,
    "algebra": 30_000,
}
DEFAULT_TIMER_MS = 30_000


# ── Normalization (copied from practice_routes for isolation) ────────────────
def normalize_val(val: str) -> str:
    val = val.strip().lower()
    val = val.replace('\\', '\\')
    val = val.replace('$', '').replace('*', '')
    val = val.replace(r'\left(', '(').replace(r'\right)', ')')
    val = val.replace(r'\left', '').replace(r'\right', '')
    val = re.sub(r'\\frac{([^}]+)}{([^}]+)}', r'\1/\2', val)
    val = re.sub(r'\\frac([a-zA-Z0-9])([a-zA-Z0-9])', r'\1/\2', val)
    val = re.sub(r'\\sqrt\s*\[\]\s*{', r'\\sqrt{', val)
    val = re.sub(r'\\sqrt\s*{([^}]+)}', r'\\sqrt{\1}', val)
    val = re.sub(r'\\sqrt\s*([a-zA-Z0-9])', r'\\sqrt{\1}', val)
    val = re.sub(r'\s*([\+\-\*/=\(\)\^,])\s*', r'\1', val)
    val = re.sub(r'\s+', ' ', val)
    val = re.sub(r'\^{\(([^()]+)\)}', r'^{\1}', val)
    return val


def is_float(val: str) -> bool:
    try:
        float(val)
        return True
    except ValueError:
        return False


def check_correct(submitted: str, correct: str) -> bool:
    sub_norm = normalize_val(submitted)
    corr_norm = normalize_val(correct)
    if is_float(sub_norm) and is_float(corr_norm):
        return abs(float(sub_norm) - float(corr_norm)) <= 0.01
    return sub_norm == corr_norm


def calculate_points(time_remaining_ms: int, total_time_ms: int) -> int:
    if total_time_ms <= 0:
        return MIN_POINTS
    ratio = max(0.0, time_remaining_ms / total_time_ms)
    return max(MIN_POINTS, int(BASE_POINTS * ratio))


def normalize_steps(raw_steps: list) -> list:
    out = []
    for s in raw_steps:
        d = dict(s)
        if "step_type" not in d and "type" in d:
            d["step_type"] = d.pop("type")
        out.append(d)
    return out


# ── Helpers: build choices list ──────────────────────────────────────────────
def build_choices(correct_value: str, distractors: list[str]) -> list[str]:
    """Return a shuffled list of [correct, d1, d2, d3]."""
    choices = [correct_value] + distractors[:3]
    random.shuffle(choices)
    return choices


# ── POST /api/quiz/start ─────────────────────────────────────────────────────
@router.post("/start", response_model=QuizStartResponse)
async def start_quiz(body: QuizStartRequest, student=Depends(get_current_student)):
    """Sample 5 problems for this node, create a quiz_sessions row, return problems with choices."""
    session_id = body.session_id
    node_id = body.node_id
    student_id = student["id"]

    if node_id not in GRAPH:
        raise HTTPException(status_code=400, detail=f"Invalid node_id: '{node_id}'")

    conn = await get_db()
    try:
        rows = await conn.fetch(
            "SELECT id, node_id, problem_expr, steps_json, word_problem_text, step_extras_json "
            "FROM practice_problems WHERE node_id = $1",
            node_id,
        )

        if len(rows) < 10:
            raise HTTPException(
                status_code=400,
                detail={"error": "no_quiz_content", "node_id": node_id},
            )

        sampled = random.sample(list(rows), PRACTICE_SET_SIZE)
        problem_ids = [r["id"] for r in sampled]

        problems_out = []
        for r in sampled:
            raw_steps = normalize_steps(json.loads(r["steps_json"]))
            extras = json.loads(r["step_extras_json"]) if r["step_extras_json"] else {}
            problem_expr = r["problem_expr"]

            steps_out = []
            for step in raw_steps:
                si = str(step["step_index"])
                step_extras = extras.get(si, {})
                distractors = step_extras.get("distractors", [])

                # Pad distractors if missing (fallback)
                while len(distractors) < 3:
                    distractors.append("Cannot determine")

                choices = build_choices(step["correct_value"], distractors)
                step_type = step.get("step_type", "algebra")

                steps_out.append({
                    "step_index": step["step_index"],
                    "step_type": step_type,
                    "instruction": step["instruction"],
                    "blank_expression": step["blank_expression"],
                    "operation_description": step.get("operation_description", ""),
                    "mapped_node_id": step.get("mapped_node_id", node_id),
                    "choices": choices,
                    "timer_ms": TIMER_MS.get(step_type, DEFAULT_TIMER_MS),
                })

            problems_out.append({
                "id": r["id"],
                "node_id": r["node_id"],
                "problem_expr": problem_expr,
                "word_problem_text": r["word_problem_text"],
                "steps": steps_out,
            })

        # Create quiz_sessions row
        quiz_session_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        await conn.execute(
            """
            INSERT INTO quiz_sessions
                (id, session_id, node_id, student_id, total_points, problems_json,
                 step_errors_json, started_at)
            VALUES ($1, $2, $3, $4, 0, $5, '[]', $6)
            """,
            quiz_session_id, session_id, node_id, student_id,
            json.dumps(problem_ids), now_iso,
        )

        return {
            "quiz_session_id": quiz_session_id,
            "problems": problems_out,
        }
    finally:
        await release_db(conn)


# ── POST /api/quiz/submit-step ───────────────────────────────────────────────
@router.post("/submit-step", response_model=QuizSubmitStepResponse)
async def submit_step(body: QuizSubmitStepRequest, student=Depends(get_current_student)):
    """
    Evaluate a single step answer. No AI call.
    submitted_value=None means timeout — 0 points, not logged as error.
    """
    conn = await get_db()
    try:
        qs = await conn.fetchrow(
            "SELECT id, total_points, node_id, step_errors_json, current_streak FROM quiz_sessions WHERE id = $1",
            body.quiz_session_id,
        )
        if not qs:
            raise HTTPException(status_code=404, detail="Quiz session not found")

        prob = await conn.fetchrow(
            "SELECT steps_json FROM practice_problems WHERE id = $1",
            body.problem_id,
        )
        if not prob:
            raise HTTPException(status_code=404, detail="Problem not found")

        steps = normalize_steps(json.loads(prob["steps_json"]))
        step = next((s for s in steps if s["step_index"] == body.step_index), None)
        if not step:
            raise HTTPException(status_code=404, detail="Step not found")

        correct_value = step["correct_value"]
        submitted = body.submitted_value  # can be None (timeout)
        current_streak = qs["current_streak"]

        # Timeout: 0 points, not logged
        if submitted is None:
            await conn.execute(
                "UPDATE quiz_sessions SET total_points = $1, current_streak = 0 WHERE id = $2",
                qs["total_points"], body.quiz_session_id,
            )
            return {
                "correct": False,
                "correct_value": correct_value,
                "points_earned": 0,
                "total_points": qs["total_points"],
                "current_streak": 0,
                "streak_multiplier": 1.0,
            }

        correct = check_correct(submitted, correct_value)
        total_time_ms = TIMER_MS.get(step.get("step_type", "algebra"), DEFAULT_TIMER_MS)

        if correct:
            new_streak = current_streak + 1
            # Streak of 1 = just unlocked (1.0x), streak of 2 = 1.1x, streak of 3 = 1.2x ...
            multiplier = round(1.0 + max(0, new_streak - 1) * 0.1, 2)
            base_points = calculate_points(body.time_remaining_ms, total_time_ms)
            points_earned = int(base_points * multiplier)
        else:
            new_streak = 0
            multiplier = 1.0
            points_earned = 0

        new_total = qs["total_points"] + points_earned
        step_errors = json.loads(qs["step_errors_json"])

        if not correct:
            step_errors.append({
                "problem_id": body.problem_id,
                "step_index": body.step_index,
                "step_type": step.get("step_type", "algebra"),
                "operation_description": step.get("operation_description", ""),
                "submitted_value": submitted,
                "correct_value": correct_value,
            })
        print("DEBUG submit_step returning:", {
            "correct": correct,
            "current_streak": new_streak,
            "streak_multiplier": multiplier,
        })

        await conn.execute(
            "UPDATE quiz_sessions SET total_points = $1, step_errors_json = $2, current_streak = $3 WHERE id = $4",
            new_total, json.dumps(step_errors), new_streak, body.quiz_session_id,
        )

        return {
            "correct": correct,
            "correct_value": correct_value,
            "points_earned": points_earned,
            "total_points": new_total,
            "current_streak": new_streak,
            "streak_multiplier": multiplier,
        }
    finally:
        await release_db(conn)


# ── POST /api/quiz/skip-step ─────────────────────────────────────────────────
@router.post("/skip-step", response_model=QuizSkipStepResponse)
async def skip_step(body: QuizSkipStepRequest, student=Depends(get_current_student)):
    """No cost, no error logged. Just returns correct_value so student can see it."""
    conn = await get_db()
    try:
        prob = await conn.fetchrow(
            "SELECT steps_json FROM practice_problems WHERE id = $1",
            body.problem_id,
        )
        if not prob:
            raise HTTPException(status_code=404, detail="Problem not found")

        steps = normalize_steps(json.loads(prob["steps_json"]))
        step = next((s for s in steps if s["step_index"] == body.step_index), None)
        if not step:
            raise HTTPException(status_code=404, detail="Step not found")

        return {"correct_value": step["correct_value"]}
    finally:
        await release_db(conn)


# ── POST /api/quiz/use-hint ──────────────────────────────────────────────────
@router.post("/use-hint", response_model=QuizUseHintResponse)
async def use_hint(body: QuizUseHintRequest, student=Depends(get_current_student)):
    """Deduct HINT_COST points. Return hint text from step_extras_json (pre-generated offline)."""
    conn = await get_db()
    try:
        qs = await conn.fetchrow(
            "SELECT id, total_points FROM quiz_sessions WHERE id = $1",
            body.quiz_session_id,
        )
        if not qs:
            raise HTTPException(status_code=404, detail="Quiz session not found")

        cost = 2500 if body.hint_type == "equation" else 750

        if qs["total_points"] < cost:
            raise HTTPException(
                status_code=400,
                detail={"code": "insufficient_points", "required": cost, "current": qs["total_points"]},
            )

        prob = await conn.fetchrow(
            "SELECT steps_json, step_extras_json FROM practice_problems WHERE id = $1",
            body.problem_id,
        )
        if not prob:
            raise HTTPException(status_code=404, detail="Problem not found")

        extras = json.loads(prob["step_extras_json"]) if prob["step_extras_json"] else {}
        step_extras = extras.get(str(body.step_index), {})

        hint_type = body.hint_type  # "hint" or "equation"

        if hint_type == "equation":
            # The equation hint is always the problem_expr — fetch it
            problem_row = await conn.fetchrow(
                "SELECT problem_expr FROM practice_problems WHERE id = $1",
                body.problem_id,
            )
            hint_text = problem_row["problem_expr"] if problem_row else "No equation available."
        else:
            hint_text = step_extras.get(
                "hint",
                "Think carefully about the operation for this step.",
            )

        new_total = qs["total_points"] - cost
        await conn.execute(
            "UPDATE quiz_sessions SET total_points = $1 WHERE id = $2",
            new_total, body.quiz_session_id,
        )

        return {
            "hint_text": hint_text,
            "points_deducted": cost,
            "total_points": new_total,
        }
    finally:
        await release_db(conn)


# ── POST /api/quiz/finish ────────────────────────────────────────────────────
@router.post("/finish", response_model=QuizFinishResponse)
async def finish_quiz(body: QuizFinishRequest, student=Depends(get_current_student)):
    """
    Finalize quiz session:
    1. Mark completed_at
    2. Calculate mastery (passed problems ≥ PASS_THRESHOLD)
    3. Log practice_attempts rows for progression compatibility
    4. Call Gemini ONCE for aggregated feedback (not stored in DB)
    5. Run progression logic
    6. Return full result including progression decision
    """
    conn = await get_db()
    try:
        qs = await conn.fetchrow(
            "SELECT id, session_id, node_id, student_id, total_points, "
            "problems_json, step_errors_json, completed_at "
            "FROM quiz_sessions WHERE id = $1",
            body.quiz_session_id,
        )
        if not qs:
            raise HTTPException(status_code=404, detail="Quiz session not found")

        if qs["completed_at"]:
            raise HTTPException(status_code=400, detail="Quiz session already finished")

        session_id = qs["session_id"]
        node_id = qs["node_id"]
        student_id = qs["student_id"]
        total_points = qs["total_points"]
        step_errors = json.loads(qs["step_errors_json"])
        problem_ids = json.loads(qs["problems_json"])

        now_iso = datetime.now(timezone.utc).isoformat()

        # ── 1. Count per-problem pass/fail based on logged errors ────────────
        # A problem is "passed" if none of its steps appear in step_errors
        error_problem_ids = {e["problem_id"] for e in step_errors}
        passed_problems = [pid for pid in problem_ids if pid not in error_problem_ids]
        passed_count = len(passed_problems)
        total_problems = len(problem_ids)
        mastery_score = passed_count / total_problems if total_problems > 0 else 0.0
        passed = passed_count >= PASS_THRESHOLD

        # Count total correct steps
        total_steps = 0
        total_correct = 0
        for pid in problem_ids:
            prob = await conn.fetchrow("SELECT steps_json FROM practice_problems WHERE id = $1", pid)
            if prob:
                steps = json.loads(prob["steps_json"])
                total_steps += len(steps)
                wrong_step_indices = {e["step_index"] for e in step_errors if e["problem_id"] == pid}
                total_correct += len(steps) - len(wrong_step_indices)

        # ── 2. Log practice_attempts for progression compatibility ───────────
        async with conn.transaction():
            await conn.execute(
                "UPDATE quiz_sessions SET completed_at = $1 WHERE id = $2",
                now_iso, body.quiz_session_id,
            )

            for pid in problem_ids:
                prob = await conn.fetchrow("SELECT steps_json FROM practice_problems WHERE id = $1", pid)
                if not prob:
                    continue
                steps = normalize_steps(json.loads(prob["steps_json"]))
                n_steps = len(steps)
                wrong_indices = {e["step_index"] for e in step_errors if e["problem_id"] == pid}
                correct_count = n_steps - len(wrong_indices)
                score = int((correct_count / n_steps) * 100) if n_steps > 0 else 0
                is_passed = 1 if correct_count == n_steps else 0

                await conn.execute(
                    """
                    INSERT INTO practice_attempts
                        (id, session_id, node_id, problem_id, student_steps_json, score, passed, attempted_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """,
                    str(uuid.uuid4()), session_id, node_id, pid,
                    json.dumps([]), score, is_passed, now_iso,
                )

        # ── 3. AI feedback (one call, not stored) ────────────────────────────
        feedback_text = await _generate_feedback(node_id, step_errors, passed)

        # ── 4. Run progression logic ─────────────────────────────────────────
        session_row = await conn.fetchrow(
            "SELECT topic_entry_node FROM sessions WHERE id = $1", session_id
        )
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        topic_entry_node = session_row["topic_entry_node"]
        progression = await _run_progression(
            conn, session_id, node_id, student_id, topic_entry_node,
            passed, passed_count, mastery_score, now_iso,
        )

        return {
            "total_points": total_points,
            "total_correct": total_correct,
            "total_steps": total_steps,
            "passed_count": passed_count,
            "step_errors": step_errors,
            "feedback_text": feedback_text,
            "progression": progression,
        }
    finally:
        await release_db(conn)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _generate_feedback(node_id: str, step_errors: list, passed: bool) -> str:
    """Call Gemini once with aggregated error data. Returns feedback string."""
    node_label = GRAPH.get(node_id, {}).get("label", "this topic")

    if not step_errors:
        if passed:
            return f"Excellent work! You answered all steps correctly in {node_label}. Keep it up!"
        return f"Good effort on {node_label}! Review your answers and try again."

    # Summarize error patterns by operation_description
    from collections import Counter
    op_counts = Counter(e.get("operation_description", "unknown step") for e in step_errors)
    error_summary = "; ".join(f"{op} ({count}x)" for op, count in op_counts.most_common())

    step_type_counts = Counter(e.get("step_type", "algebra") for e in step_errors)
    has_var_id_errors = step_type_counts.get("variable_identification", 0) > 0
    has_algebra_errors = step_type_counts.get("algebra", 0) > 0

    prompt = (
        f"You are a supportive math tutor for Philippine JHS students.\n"
        f"The student just completed a quiz on: {node_label}.\n"
        f"Result: {'PASSED' if passed else 'DID NOT PASS'}\n\n"
        f"Steps they got wrong (operation: count): {error_summary}\n"
        f"Variable identification errors: {step_type_counts.get('variable_identification', 0)}\n"
        f"Algebra step errors: {step_type_counts.get('algebra', 0)}\n\n"
        f"Write 3-4 sentences of encouraging, constructive feedback.\n"
        f"{'Mention that they struggled with identifying variables from word problems.' if has_var_id_errors else ''}\n"
        f"{'Mention the specific algebra operations they missed.' if has_algebra_errors else ''}\n"
        f"Be specific about what to review. Name {node_label} explicitly.\n"
        f"Do not include math formatting or LaTeX."
    )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return f"Keep practicing {node_label}! Focus on the steps you missed and try again."

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        response = await asyncio.wait_for(
            model.generate_content_async(prompt),
            timeout=20.0,
        )
        return response.text.strip()
    except Exception as ex:
        print(f"Gemini feedback failed: {ex}")
        return f"Good effort on {node_label}! Review the steps you missed and try again."


async def _run_progression(
    conn, session_id, node_id, student_id, topic_entry_node,
    passed, passed_count, mastery_score, now_iso
) -> dict:
    """Mirror the logic from progression_routes.py decide_progression."""
    base = {
        "decision": "advance" if passed else "remediate",
        "mastery_score": mastery_score,
        "passed_count": passed_count,
    }

    async with conn.transaction():
        await conn.execute(
            """
            INSERT INTO progression_logs (id, session_id, node_id, mastery_score, decision, logged_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            str(uuid.uuid4()), session_id, node_id, mastery_score,
            "advance" if passed else "remediate", now_iso,
        )

        if passed:
            await upsert_status(conn, student_id, node_id, "mastered", "practice")
            await mark_prerequisites_mastered(conn, student_id, node_id, topic_entry_node)

            if node_id == topic_entry_node:
                await conn.execute(
                    "UPDATE sessions SET completed = 1, last_active_at = $1 WHERE id = $2",
                    now_iso, session_id,
                )
                await compute_and_save_session_progress(conn, session_id, student_id, topic_entry_node)
                return {**base, "topic_complete": True}

            next_node = await find_next_upward(conn, student_id, node_id, topic_entry_node)

            chain = get_chain(topic_entry_node)
            all_statuses = []
            for n in chain:
                s = await get_status(conn, student_id, n)
                all_statuses.append(s["status"] if s else "unresolved")
            all_mastered = all(s == "mastered" for s in all_statuses)

            if all_mastered or next_node is None:
                await conn.execute(
                    "UPDATE sessions SET completed = 1, last_active_at = $1 WHERE id = $2",
                    now_iso, session_id,
                )
                await compute_and_save_session_progress(conn, session_id, student_id, topic_entry_node)
                return {**base, "topic_complete": True}

            await upsert_status(conn, student_id, next_node, "in_progress", "practice")
            await conn.execute(
                "UPDATE sessions SET current_node = $1, last_active_at = $2 WHERE id = $3",
                next_node, now_iso, session_id,
            )
            await compute_and_save_session_progress(conn, session_id, student_id, topic_entry_node)
            return {
                **base,
                "next_node_id": next_node,
                "next_node_label": GRAPH[next_node]["label"],
                "topic_complete": False,
            }

        # Remediate path
        await upsert_status(conn, student_id, node_id, "unresolved", "practice")

        prereq = GRAPH[node_id]["prerequisite"]
        go_deeper_available = prereq is not None
        go_deeper_node = None
        if go_deeper_available:
            await upsert_status(conn, student_id, prereq, "in_progress", "practice")
            go_deeper_node = {"node_id": prereq, "node_label": GRAPH[prereq]["label"]}

        await conn.execute(
            "UPDATE sessions SET last_active_at = $1 WHERE id = $2",
            now_iso, session_id,
        )
        await compute_and_save_session_progress(conn, session_id, student_id, topic_entry_node)

        return {
            **base,
            "go_deeper_available": go_deeper_available,
            "go_deeper_node": go_deeper_node,
            "misconception_nodes": [],
        }

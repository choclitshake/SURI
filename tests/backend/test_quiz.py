"""Module 8 — Gamified Quiz & Streak Engine (backend/routes/quiz_routes.py)."""

import json

import pytest

from backend.routes.quiz_routes import BASE_POINTS, MIN_POINTS, calculate_points, check_correct
from helpers import (
    get_status,
    make_problem,
    make_problems,
    make_quiz_session,
    make_session,
    make_student,
    step,
)


async def setup_quiz(db, total_points=0, streak=0, steps=None):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD")
    problem_id = await make_problem(db, "FD", steps=steps or [step(0, "6")])
    quiz_id = await make_quiz_session(db, session_id, student["id"], total_points=total_points,
                                      streak=streak, problem_ids=[problem_id])
    return student, session_id, problem_id, quiz_id


async def submit(client, student, quiz_id, problem_id, value, time_ms=60_000, save_streak=False):
    return await client.post("/api/quiz/submit-step", json={
        "quiz_session_id": quiz_id, "problem_id": problem_id, "step_index": 0,
        "submitted_value": value, "time_remaining_ms": time_ms, "save_streak": save_streak,
    }, headers=student["headers"])


async def test_TC41_quiz_start_rejects_unknown_node(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"])

    res = await client.post("/api/quiz/start", json={"session_id": session_id, "node_id": "INVALID"},
                            headers=student["headers"])

    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid node_id: 'INVALID'"


async def test_TC42_correct_answer_full_time_awards_base_points(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db)

    res = await submit(client, student, quiz_id, problem_id, "6", time_ms=60_000)

    body = res.json()
    assert res.status_code == 200
    assert body["correct"] is True and body["points_earned"] == 500
    assert body["current_streak"] == 1 and body["streak_multiplier"] == 1.0
    assert body["total_points"] == 500
    row = await db.fetchrow("SELECT total_points, current_streak FROM quiz_sessions WHERE id = $1",
                            quiz_id)
    assert tuple(row) == (500, 1)


async def test_TC43_streak_multiplier_scales_points(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, streak=4)

    res = await submit(client, student, quiz_id, problem_id, "6", time_ms=60_000)

    body = res.json()
    assert body["current_streak"] == 5 and body["streak_multiplier"] == 1.4
    assert body["points_earned"] == 700


async def test_TC43b_wrong_answer_without_save_resets_streak_and_logs_error(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, total_points=600, streak=2)

    res = await submit(client, student, quiz_id, problem_id, "7")
    no_problem = await submit(client, student, quiz_id, "unknown-problem", "7")

    body = res.json()
    assert body["correct"] is False and body["points_earned"] == 0
    assert body["current_streak"] == 0 and body["streak_multiplier"] == 1.0
    assert body["total_points"] == 600 and body["correct_value"] == "6"
    errors = json.loads(await db.fetchval(
        "SELECT step_errors_json FROM quiz_sessions WHERE id = $1", quiz_id))
    assert errors == [{"problem_id": problem_id, "step_index": 0, "step_type": "algebra",
                       "operation_description": "Simplify", "submitted_value": "7",
                       "correct_value": "6"}]
    assert no_problem.status_code == 404 and no_problem.json()["detail"] == "Problem not found"


async def test_TC44_timeout_awards_zero_and_resets_streak(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, total_points=800, streak=5)

    res = await submit(client, student, quiz_id, problem_id, None)

    body = res.json()
    assert body["correct"] is False and body["points_earned"] == 0
    assert body["current_streak"] == 0 and body["streak_multiplier"] == 1.0
    assert body["total_points"] == 800
    row = await db.fetchrow("SELECT step_errors_json, current_streak FROM quiz_sessions WHERE id = $1",
                            quiz_id)
    errors = json.loads(row["step_errors_json"])
    assert len(errors) == 1 and errors[0]["submitted_value"] is None
    assert row["current_streak"] == 0


async def test_TC45_save_streak_rejected_below_1000_points(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, total_points=999)

    res = await client.post("/api/quiz/use-hint", json={
        "quiz_session_id": quiz_id, "problem_id": problem_id, "step_index": 0,
        "hint_type": "save_streak", "saved_streak": 3,
    }, headers=student["headers"])

    assert res.status_code == 400
    assert res.json()["detail"] == {"code": "insufficient_points", "required": 1000, "current": 999}


async def test_TC46_wrong_answer_with_save_streak_deducts_1000(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, total_points=2500, streak=3)

    res = await submit(client, student, quiz_id, problem_id, "7", save_streak=True)

    body = res.json()
    assert body["correct"] is False and body["current_streak"] == 3
    errors = json.loads(await db.fetchval(
        "SELECT step_errors_json FROM quiz_sessions WHERE id = $1", quiz_id))
    assert len(errors) == 1 and errors[0]["submitted_value"] == "7"
    assert body["total_points"] == 1500


async def test_TC66_save_streak_at_exactly_1000_points(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, total_points=1000, streak=0)

    res = await client.post("/api/quiz/use-hint", json={
        "quiz_session_id": quiz_id, "problem_id": problem_id, "step_index": 0,
        "hint_type": "save_streak", "saved_streak": 4,
    }, headers=student["headers"])

    assert res.status_code == 200
    assert res.json() == {"hint_text": "", "points_deducted": 1000, "total_points": 0}
    row = await db.fetchrow("SELECT total_points, current_streak FROM quiz_sessions WHERE id = $1",
                            quiz_id)
    assert tuple(row) == (0, 4)


async def test_TC69_quiz_start_builds_choices_and_timers(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    steps = [step(0, "x", step_type="variable_identification"), step(1, "6")]
    extras = {"0": {"distractors": ["y", "z", "w"]}, "1": {"distractors": ["5"]}}
    await make_problems(db, "FD", 10, steps=steps, extras=extras)
    few = await make_student(db)
    few_session = await make_session(db, few["id"], current_node="PE")

    res = await client.post("/api/quiz/start", json={"session_id": session_id, "node_id": "FD"},
                            headers=student["headers"])
    empty = await client.post("/api/quiz/start", json={"session_id": few_session, "node_id": "PE"},
                              headers=few["headers"])

    body = res.json()
    assert res.status_code == 200 and len(body["problems"]) == 5
    var_step, alg_step = body["problems"][0]["steps"]
    assert sorted(var_step["choices"]) == ["w", "x", "y", "z"] and var_step["timer_ms"] == 60_000
    assert sorted(alg_step["choices"]) == ["5", "6", "Cannot determine", "Cannot determine"]
    assert alg_step["timer_ms"] == 60_000
    row = await db.fetchrow("SELECT problems_json, total_points FROM quiz_sessions WHERE id = $1",
                            body["quiz_session_id"])
    assert len(json.loads(row["problems_json"])) == 5 and row["total_points"] == 0
    assert empty.status_code == 400 and empty.json()["detail"]["error"] == "no_quiz_content"


async def test_TC70_hint_and_skip_step(client, db):
    student, _, problem_id, quiz_id = await setup_quiz(db, total_points=800)
    await db.execute("UPDATE practice_problems SET step_extras_json = $1 WHERE id = $2",
                     json.dumps({"0": {"hint": "Divide both sides."}}), problem_id)
    body = {"quiz_session_id": quiz_id, "problem_id": problem_id, "step_index": 0}

    hint = await client.post("/api/quiz/use-hint", json=body, headers=student["headers"])
    broke = await client.post("/api/quiz/use-hint", json=body, headers=student["headers"])
    skip = await client.post("/api/quiz/skip-step", json=body, headers=student["headers"])
    bad_step = await client.post("/api/quiz/skip-step", json={**body, "step_index": 9},
                                 headers=student["headers"])
    bad_quiz = await submit(client, student, "unknown", problem_id, "6")

    assert hint.json() == {"hint_text": "Divide both sides.", "points_deducted": 750,
                           "total_points": 50}
    assert broke.status_code == 400 and broke.json()["detail"]["required"] == 750
    assert skip.json() == {"correct_value": "6"}
    assert bad_step.status_code == 404 and bad_step.json()["detail"] == "Step not found"
    assert bad_quiz.status_code == 404 and bad_quiz.json()["detail"] == "Quiz session not found"


async def test_TC71_finish_quiz_runs_progression_once(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD")
    problem_ids = await make_problems(db, "FD", 5, steps=[step(0, "6"), step(1, "7")])
    errors = [{"problem_id": problem_ids[0], "step_index": 1, "step_type": "algebra",
               "operation_description": "Simplify", "submitted_value": "8", "correct_value": "7"}]
    quiz_id = await make_quiz_session(db, session_id, student["id"], total_points=1800,
                                      problem_ids=problem_ids, errors=errors)

    res = await client.post("/api/quiz/finish", json={"quiz_session_id": quiz_id},
                            headers=student["headers"])
    again = await client.post("/api/quiz/finish", json={"quiz_session_id": quiz_id},
                              headers=student["headers"])

    body = res.json()
    assert res.status_code == 200
    assert body["passed_count"] == 4 and body["total_steps"] == 10 and body["total_correct"] == 9
    assert body["progression"]["decision"] == "advance"
    assert body["progression"]["next_node_id"] == "OI"
    assert "Fractions & Decimals" in body["feedback_text"]
    assert tuple(await get_status(db, student["id"], "FD")) == ("mastered", "practice")
    assert await db.fetchval("SELECT COUNT(*) FROM practice_attempts WHERE session_id = $1",
                             session_id) == 5
    assert again.status_code == 400 and again.json()["detail"] == "Quiz session already finished"
    logs = await db.fetch("SELECT problem_id, step_index, mapped_node_id FROM misconception_logs "
                          "WHERE session_id = $1", session_id)
    assert [tuple(r) for r in logs] == [(problem_ids[0], 1, "FD")]


async def test_TC71b_finish_quiz_failing_round_remediates(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="SP")
    problem_ids = await make_problems(db, "SP", 5, steps=[step(0, "6")])
    errors = [{"problem_id": pid, "step_index": 0, "step_type": "algebra",
               "operation_description": "Expand", "submitted_value": "1", "correct_value": "6"}
              for pid in problem_ids[:2]]
    quiz_id = await make_quiz_session(db, session_id, student["id"], node_id="SP",
                                      problem_ids=problem_ids, errors=errors)

    res = await client.post("/api/quiz/finish", json={"quiz_session_id": quiz_id},
                            headers=student["headers"])

    progression = res.json()["progression"]
    assert progression["decision"] == "remediate" and progression["mastery_score"] == 0.6
    assert progression["go_deeper_node"] == {"node_id": "LE", "node_label": "Laws of Exponents"}
    assert tuple(await get_status(db, student["id"], "SP")) == ("unresolved", "practice")
    assert await db.fetchval("SELECT COUNT(*) FROM misconception_logs WHERE session_id = $1",
                             session_id) == 2


def test_TC72_calculate_points_floor_and_ceiling():
    assert calculate_points(60_000, 60_000) == BASE_POINTS == 500
    assert calculate_points(30_000, 60_000) == 250
    assert calculate_points(0, 60_000) == MIN_POINTS == 100
    assert calculate_points(-5_000, 60_000) == MIN_POINTS
    assert calculate_points(10_000, 0) == MIN_POINTS
    assert check_correct("2.004", "2") is True
    assert check_correct(r"\frac{1}{2}", "1/2") is True


async def test_TC80_quiz_rejects_another_students_session(client, db):
    intruder = await make_student(db)
    _, session_id, problem_id, quiz_id = await setup_quiz(db, total_points=1000)
    await make_problems(db, "FD", 10)
    base = {"quiz_session_id": quiz_id, "problem_id": problem_id, "step_index": 0}

    start = await client.post("/api/quiz/start", json={"session_id": session_id, "node_id": "FD"},
                              headers=intruder["headers"])
    skip = await client.post("/api/quiz/skip-step", json=base, headers=intruder["headers"])
    hint = await client.post("/api/quiz/use-hint", json=base, headers=intruder["headers"])
    finish = await client.post("/api/quiz/finish", json={"quiz_session_id": quiz_id},
                               headers=intruder["headers"])
    scored = await submit(client, intruder, quiz_id, problem_id, "6")

    assert {start.status_code, skip.status_code, hint.status_code,
            finish.status_code, scored.status_code} == {404}
    assert await db.fetchval("SELECT total_points FROM quiz_sessions WHERE id = $1", quiz_id) == 1000
    assert await db.fetchval("SELECT completed_at FROM quiz_sessions WHERE id = $1", quiz_id) is None

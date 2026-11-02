"""Module 4 — Diagnostic Assessment (backend/routes/diagnostic_routes.py)."""

import pytest

from backend.routes.diagnostic_routes import PROBES, _probe_order
from helpers import add_diagnostic_logs, get_status, make_session, make_student

UNKNOWN_SESSION = "00000000-0000-0000-0000-000000000000"


def correct_option(node_id, probe_index):
    return PROBES[node_id][probe_index]["correct_option_index"]


def wrong_option(node_id, probe_index):
    return (correct_option(node_id, probe_index) + 1) % 4


async def answer(client, student, session_id, node_id, option):
    return await client.post(
        f"/api/diagnostic/{session_id}/answer",
        json={"node_id": node_id, "selected_option_index": option},
        headers=student["headers"],
    )


async def logs_for(db, session_id):
    return await db.fetch(
        "SELECT node_id, probe_result FROM diagnostic_logs WHERE session_id = $1 ORDER BY logged_at",
        session_id,
    )


async def test_TC15_answer_unknown_session(client, db):
    student = await make_student(db)

    res = await answer(client, student, UNKNOWN_SESSION, "QE", 0)

    assert res.status_code == 404
    assert res.json()["detail"] == "Session not found"
    assert await db.fetchval("SELECT COUNT(*) FROM diagnostic_logs") == 0


async def test_TC16_answer_completed_session(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], probe_index=0, completed=1)

    res = await answer(client, student, session_id, "QE", 0)

    assert res.status_code == 400
    assert res.json()["detail"] == "Diagnostic session is already completed"


async def test_TC17_answer_without_active_probe(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], probe_index=None)

    res = await answer(client, student, session_id, "QE", 0)

    assert res.status_code == 400
    assert res.json()["detail"] == "No active probe found. Fetch a probe first."


async def test_TC18_answer_with_mismatched_node(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="QE", probe_index=0)

    res = await answer(client, student, session_id, "FP", 0)

    assert res.status_code == 400
    assert res.json()["detail"] == (
        "Submitted node_id 'FP' does not match current session node 'QE'"
    )
    assert await db.fetchval("SELECT COUNT(*) FROM diagnostic_logs") == 0


@pytest.mark.parametrize("option", [-1, 4])
async def test_TC19_option_index_outside_0_to_3_is_incorrect(client, db, option):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="QE", probe_index=0)

    res = await answer(client, student, session_id, "QE", option)

    assert res.status_code == 200
    assert res.json()["correct"] is False
    assert [tuple(r) for r in await logs_for(db, session_id)] == [("QE", 0)]


async def test_TC20_first_probe_keeps_student_on_node(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD", probe_index=0)

    res = await answer(client, student, session_id, "FD", correct_option("FD", 0))

    body = res.json()
    assert res.status_code == 200
    assert body["correct"] is True
    assert body["next_action"] == "next_probe" and body["node_complete"] is False
    assert body["questions_answered"] == 1 and body["questions_total"] == 4
    assert body["next_node_id"] == "FD"
    assert await db.fetchval("SELECT current_probe_index FROM sessions WHERE id = $1",
                             session_id) is None


async def test_TC21_option_index_upper_boundary_three(client, db):
    student = await make_student(db)
    assert correct_option("FD", 6) == 3
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD", probe_index=6)

    res = await answer(client, student, session_id, "FD", 3)

    assert res.status_code == 200
    assert res.json()["correct"] is True
    assert [tuple(r) for r in await logs_for(db, session_id)] == [("FD", 1)]


async def test_TC22_fourth_probe_passing_score_advances(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD", probe_index=0)
    await add_diagnostic_logs(db, session_id, "FD", [1, 1, 0])

    res = await answer(client, student, session_id, "FD", correct_option("FD", 0))

    body = res.json()
    assert body["next_action"] == "next_probe" and body["node_complete"] is True
    assert body["node_passed"] is True and body["correct_count"] == 3
    assert body["next_node_id"] == "OI"
    row = await db.fetchrow("SELECT current_node, current_probe_index FROM sessions WHERE id = $1",
                            session_id)
    assert row["current_node"] == "OI" and row["current_probe_index"] is None


async def test_TC23_second_wrong_answer_fails_node_and_stops(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="SP", probe_index=0)
    await add_diagnostic_logs(db, session_id, "SP", [1, 0])

    res = await answer(client, student, session_id, "SP", wrong_option("SP", 0))

    body = res.json()
    assert body["correct"] is False
    assert body["next_action"] == "complete" and body["node_complete"] is True
    assert body["node_passed"] is False
    assert body["correct_count"] == 1 and body["wrong_count"] == 2
    assert body["questions_answered"] == 3
    assert body["next_node_id"] is None and body["identified_node_id"] == "SP"
    assert body["prerequisite_path"][0] == "SP" and body["prerequisite_path"][-1] == "QE"
    assert await db.fetchval("SELECT current_node FROM sessions WHERE id = $1", session_id) == "SP"


async def test_TC75_third_correct_answer_passes_node_early(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD", probe_index=0)
    await add_diagnostic_logs(db, session_id, "FD", [1, 1])

    res = await answer(client, student, session_id, "FD", correct_option("FD", 0))

    body = res.json()
    assert body["next_action"] == "next_probe" and body["node_complete"] is True
    assert body["node_passed"] is True and body["questions_answered"] == 3
    assert body["correct_count"] == 3 and body["wrong_count"] == 0
    assert body["next_node_id"] == "OI"


async def test_TC76_one_wrong_answer_keeps_node_open(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD", probe_index=0)
    await add_diagnostic_logs(db, session_id, "FD", [1, 1])

    res = await answer(client, student, session_id, "FD", wrong_option("FD", 0))

    body = res.json()
    assert body["next_action"] == "next_probe" and body["node_complete"] is False
    assert body["correct_count"] == 2 and body["wrong_count"] == 1
    assert body["questions_answered"] == 3 and body["next_node_id"] == "FD"


async def test_TC77_probe_on_decided_node_returns_complete(client, db):
    student = await make_student(db)
    failed = await make_session(db, student["id"], topic="QE", current_node="SP")
    passed = await make_session(db, student["id"], topic="QE", current_node="FD")
    open_node = await make_session(db, student["id"], topic="QE", current_node="OI")
    await add_diagnostic_logs(db, failed, "SP", [1, 0, 0])
    await add_diagnostic_logs(db, passed, "FD", [1, 1, 1])
    await add_diagnostic_logs(db, open_node, "OI", [1, 0])

    res_failed = await client.get(f"/api/diagnostic/{failed}/probe", headers=student["headers"])
    res_passed = await client.get(f"/api/diagnostic/{passed}/probe", headers=student["headers"])
    res_open = await client.get(f"/api/diagnostic/{open_node}/probe", headers=student["headers"])

    for res in (res_failed, res_passed):
        body = res.json()
        assert res.status_code == 200
        assert body["next_action"] == "complete" and body["options"] == []
    assert res_failed.json()["wrong_count"] == 2
    assert res_passed.json()["correct_count"] == 3
    assert res_open.json().get("next_action") is None and len(res_open.json()["options"]) == 4
    assert res_open.json()["correct_count"] == 1 and res_open.json()["wrong_count"] == 1


async def test_TC24_fourth_probe_at_entry_node_completes(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="QE", probe_index=0)
    await add_diagnostic_logs(db, session_id, "QE", [1, 1, 1])

    res = await answer(client, student, session_id, "QE", correct_option("QE", 0))

    body = res.json()
    assert body["next_action"] == "complete" and body["node_complete"] is True
    assert body["node_passed"] is True and body["correct_count"] == 4
    assert body["next_node_id"] is None and body["identified_node_id"] == "QE"
    assert body["prerequisite_path"] == ["QE"]


async def test_TC24b_fourth_probe_failing_at_entry_node_completes(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="QE", probe_index=0)
    await add_diagnostic_logs(db, session_id, "QE", [0, 0, 1])

    res = await answer(client, student, session_id, "QE", correct_option("QE", 0) + 1)

    body = res.json()
    assert body["correct"] is False
    assert body["next_action"] == "complete" and body["node_passed"] is False
    assert body["correct_count"] == 1 and body["identified_node_id"] == "QE"


async def test_TC55_get_probe_selects_unrepeated_question(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD")
    done = await make_session(db, student["id"], topic="RER", current_node="FD", completed=1)
    await add_diagnostic_logs(db, session_id, "FD", [1])

    res = await client.get(f"/api/diagnostic/{session_id}/probe", headers=student["headers"])
    completed = await client.get(f"/api/diagnostic/{done}/probe", headers=student["headers"])
    missing = await client.get(f"/api/diagnostic/{UNKNOWN_SESSION}/probe", headers=student["headers"])

    expected_idx = _probe_order(session_id, "FD", PROBES["FD"])[1]
    body = res.json()
    assert res.status_code == 200
    assert body["node_id"] == "FD" and body["questions_answered"] == 1
    assert body["question_text"] == PROBES["FD"][expected_idx]["question_text"]
    assert len(body["options"]) == 4 and "correct_option_index" not in body
    assert await db.fetchval("SELECT current_probe_index FROM sessions WHERE id = $1",
                             session_id) == expected_idx
    assert completed.status_code == 400
    assert missing.status_code == 404


async def test_TC56_submit_identifies_deepest_unresolved_gap(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="QE")
    await add_diagnostic_logs(db, session_id, "FD", [1, 1, 1, 1])
    await add_diagnostic_logs(db, session_id, "OI", [1, 1, 0, 0])
    await add_diagnostic_logs(db, session_id, "LE", [1, 1, 1, 0])

    res = await client.post(f"/api/diagnostic/{session_id}/submit", json={"answers": []},
                            headers=student["headers"])

    body = res.json()
    assert res.status_code == 200
    assert body["all_mastered"] is False and body["gap_node"] == "OI"
    assert [n["node_id"] for n in body["mastered_nodes"]] == ["LE", "FD"]
    assert [n["node_id"] for n in body["unresolved_nodes"]] == ["QE", "FP", "SP", "OI"]
    assert (await get_status(db, student["id"], "FD"))["status"] == "mastered"
    assert (await get_status(db, student["id"], "OI"))["source"] == "diagnostic"
    row = await db.fetchrow("SELECT current_node, completed FROM sessions WHERE id = $1", session_id)
    assert row["current_node"] == "OI" and row["completed"] == 0


async def test_TC57_submit_with_every_node_mastered_completes_topic(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="RER", current_node="RER")
    for node in ("RER", "LE", "OI", "FD"):
        await add_diagnostic_logs(db, session_id, node, [1, 1, 1, 0])

    res = await client.post(f"/api/diagnostic/{session_id}/submit", json={"answers": []},
                            headers=student["headers"])
    missing = await client.post(f"/api/diagnostic/{UNKNOWN_SESSION}/submit", json={"answers": []},
                                headers=student["headers"])

    assert res.status_code == 200
    assert res.json()["all_mastered"] is True and res.json()["redirect"] == f"/session/{session_id}/gap-result"
    row = await db.fetchrow("SELECT completed, completion_percentage FROM sessions WHERE id = $1",
                            session_id)
    assert row["completed"] == 1 and row["completion_percentage"] == 100.0
    assert missing.status_code == 404


async def test_TC58_skip_diagnostic_starts_at_entry_node(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD", probe_index=3)

    res = await client.post("/api/diagnostic/skip", json={"session_id": session_id},
                            headers=student["headers"])
    missing = await client.post("/api/diagnostic/skip", json={"session_id": UNKNOWN_SESSION},
                                headers=student["headers"])

    assert res.status_code == 200
    assert res.json() == {"redirect_node": "QE", "node_label": "Quadratic Equations",
                          "redirect": f"/session/{session_id}/lesson"}
    assert tuple(await get_status(db, student["id"], "QE")) == ("in_progress", "skipped")
    assert tuple(await get_status(db, student["id"], "FD")) == ("unresolved", "skipped")
    row = await db.fetchrow("SELECT current_node, current_probe_index FROM sessions WHERE id = $1",
                            session_id)
    assert row["current_node"] == "QE" and row["current_probe_index"] is None
    assert missing.status_code == 404

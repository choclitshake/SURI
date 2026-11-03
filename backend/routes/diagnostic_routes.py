import uuid
import json
import random
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from backend.auth import get_current_student
from backend.database import get_db, release_db
from backend.models.schemas import (
    DiagnosticAnswerRequest,
    DiagnosticSubmitRequest,
    DiagnosticSkipRequest,
    DiagnosticSpellRequest,
)
from backend.diagnostic_battle import (
    DIAGNOSTIC_BATTLE_TABLE_SQL, new_diagnostic_battle, battle_snapshot,
    resolve_diagnostic_spell, resolve_diagnostic_hit,
)
from backend.graph import GRAPH, get_prerequisite_path
from backend.competency_utils import get_chain, upsert_status, get_statuses, batch_upsert_statuses
from backend.progress_utils import compute_and_save_session_progress

router = APIRouter(prefix="/api/diagnostic", tags=["diagnostic"])

# ---------------------------------------------------------------------------
# Load probe bank from JSON (generated offline, 16 questions per node)
# ---------------------------------------------------------------------------
_PROBES_PATH = Path(__file__).parent.parent / "data" / "diagnostic_probes.json"

def _load_probes() -> dict:
    try:
        with open(_PROBES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise RuntimeError(f"Failed to load diagnostic_probes.json: {e}")

PROBES: dict = _load_probes()

QUESTIONS_PER_NODE = 4
CHALLENGE_PER_NODE = 1  # of the QUESTIONS_PER_NODE, this many come from challenge probes
PASS_THRESHOLD = 3  # >= 3/4 (75%) = mastered
FAIL_WRONG_LIMIT = QUESTIONS_PER_NODE - PASS_THRESHOLD + 1  # 2 wrong = 3/4 unreachable


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _probe_order(session_id: str, node_id: str, probes: list[dict]) -> list[int]:
    """Return a deterministic, session-specific order of probe indices.

    The first QUESTIONS_PER_NODE positions hold standard probes plus
    CHALLENGE_PER_NODE challenge probes (at a seeded position); the rest follow
    shuffled so the wrap-around still works. Probes without "difficulty" are standard.
    """
    seed = int(hashlib.md5(f"{session_id}:{node_id}".encode()).hexdigest(), 16)
    rng = random.Random(seed)
    standard = [i for i, p in enumerate(probes) if p.get("difficulty", "standard") != "challenge"]
    challenge = [i for i, p in enumerate(probes) if p.get("difficulty") == "challenge"]
    rng.shuffle(standard)
    rng.shuffle(challenge)

    n_challenge = min(CHALLENGE_PER_NODE, len(challenge))
    n_standard = min(QUESTIONS_PER_NODE - n_challenge, len(standard))
    head = standard[:n_standard] + challenge[:n_challenge]
    rng.shuffle(head)
    rest = standard[n_standard:] + challenge[n_challenge:]
    rng.shuffle(rest)
    return head + rest


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/skip")
async def skip_diagnostic(
    body: DiagnosticSkipRequest,
    student=Depends(get_current_student),
):
    """Skip diagnostic and start learning at the entry node."""
    session_id = body.session_id
    conn = await get_db()
    try:
        session_row = await conn.fetchrow(
            """
            SELECT topic_entry_node, student_id
            FROM sessions
            WHERE id = $1 AND student_id = $2
            """,
            session_id, student["id"],
        )
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        topic_entry_node = session_row["topic_entry_node"]
        student_id = session_row["student_id"]
        chain = get_chain(topic_entry_node)

        async with conn.transaction():
            if chain:
                entries = [(student_id, chain[0], "in_progress", "skipped")]
                entries += [
                    (student_id, node_id, "unresolved", "skipped")
                    for node_id in chain[1:]
                ]
                await batch_upsert_statuses(conn, entries)

            now_iso = datetime.now(timezone.utc).isoformat()
            await conn.execute(
                """
                UPDATE sessions
                SET current_node = $1, current_probe_index = NULL,
                    last_active_at = $2, completed = 0
                WHERE id = $3
                """,
                topic_entry_node, now_iso, session_id,
            )

        return {
            "redirect_node": topic_entry_node,
            "node_label": GRAPH[topic_entry_node]["label"],
            "redirect": f"/session/{session_id}/lesson",
        }
    finally:
        await release_db(conn)


@router.post("/{session_id}/submit")
async def submit_diagnostic(
    session_id: str,
    body: DiagnosticSubmitRequest,
    student=Depends(get_current_student),
):
    """Finalize diagnostic: compute per-node mastery from logs and route student."""
    conn = await get_db()
    try:
        session_row = await conn.fetchrow(
            """
            SELECT topic_entry_node, student_id
            FROM sessions
            WHERE id = $1 AND student_id = $2
            """,
            session_id, student["id"],
        )
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        topic_entry_node = session_row["topic_entry_node"]
        student_id = session_row["student_id"]
        chain = get_chain(topic_entry_node)

        # Pull per-node correct counts from diagnostic_logs
        log_rows = await conn.fetch(
            """
            SELECT node_id, COUNT(*) as total, SUM(probe_result) as correct
            FROM diagnostic_logs
            WHERE session_id = $1
            GROUP BY node_id
            """,
            session_id,
        )
        node_scores: dict[str, dict] = {
            row["node_id"]: {"total": row["total"], "correct": int(row["correct"] or 0)}
            for row in log_rows
        }

        async with conn.transaction():
            for node_id in chain:
                if node_id not in GRAPH:
                    continue
                scores = node_scores.get(node_id, {"total": 0, "correct": 0})
                # Only nodes that have been assessed at all get a definitive status
                if scores["total"] > 0:
                    passed = scores["correct"] >= PASS_THRESHOLD
                    new_status = "mastered" if passed else "unresolved"
                    await upsert_status(conn, student_id, node_id, new_status, "diagnostic")
                else:
                    # Node was never assessed (e.g. student got all correct before reaching it)
                    await upsert_status(conn, student_id, node_id, "unresolved", "diagnostic")

                        # One round trip for the whole chain instead of one per node
            # per loop below — the writes just happened in this same
            # transaction, so this read sees them.
            statuses_map = await get_statuses(conn, student_id, chain)

            # Find the deepest unresolved node as the learning gap
            gap_node = None
            for node_id in reversed(chain):
                row = statuses_map.get(node_id)
                if row and row["status"] == "unresolved":
                    gap_node = node_id
                    break

            node_statuses = []
            mastered_nodes = []
            unresolved_nodes = []
            for node_id in chain:
                row = statuses_map.get(node_id)
                s = row["status"] if row else None
                src = row["source"] if row else None
                node_statuses.append({
                    "node_id": node_id,
                    "node_label": GRAPH[node_id]["label"],
                    "status": s,
                    "source": src,
                })
                if s == "mastered":
                    mastered_nodes.append({"node_id": node_id, "node_label": GRAPH[node_id]["label"], "source": src})
                elif s == "unresolved":
                    unresolved_nodes.append({"node_id": node_id, "node_label": GRAPH[node_id]["label"]})

            now_iso = datetime.now(timezone.utc).isoformat()

            if gap_node is None:
                await conn.execute(
                    """
                    UPDATE sessions
                    SET completed = 1, current_node = $1,
                        current_probe_index = NULL, last_active_at = $2
                    WHERE id = $3
                    """,
                    topic_entry_node, now_iso, session_id,
                )
                await compute_and_save_session_progress(conn, session_id, student_id, topic_entry_node)
                return {
                    "all_mastered": True,
                    "message": "You have already mastered all competencies in this topic.",
                    "redirect": f"/session/{session_id}/gap-result",
                    "node_statuses": node_statuses,
                }

            await conn.execute(
                """
                UPDATE sessions
                SET current_node = $1, current_probe_index = NULL,
                    completed = 0, last_active_at = $2
                WHERE id = $3
                """,
                gap_node, now_iso, session_id,
            )

        return {
            "all_mastered": False,
            "gap_node": gap_node,
            "gap_node_label": GRAPH[gap_node]["label"],
            "mastered_nodes": mastered_nodes,
            "unresolved_nodes": unresolved_nodes,
            "redirect": f"/session/{session_id}/gap-result",
            "node_statuses": node_statuses,
        }
    finally:
        await release_db(conn)


@router.get("/{session_id}/probe")
async def get_diagnostic_probe(session_id: str, student=Depends(get_current_student)):
    """Get the next diagnostic probe for the current node, avoiding repeats."""
    conn = await get_db()
    try:
        session_row = await conn.fetchrow(
            "SELECT current_node, completed FROM sessions WHERE id = $1 AND student_id = $2",
            session_id, student["id"],
        )
        if not session_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        if session_row["completed"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Diagnostic session is already completed")

        current_node = session_row["current_node"]
        if current_node not in PROBES:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No probes configured for node '{current_node}'",
            )

        probes_list = PROBES[current_node]

        # Count how many questions already answered for this node in this session
        answered_count_row = await conn.fetchrow(
            "SELECT COUNT(*) as cnt FROM diagnostic_logs WHERE session_id = $1 AND node_id = $2",
            session_id, current_node,
        )
        answered_count = answered_count_row["cnt"] if answered_count_row else 0

        correct_row = await conn.fetchrow(
            "SELECT COALESCE(SUM(probe_result), 0) AS correct FROM diagnostic_logs WHERE session_id = $1 AND node_id = $2",
            session_id, current_node,
        )
        correct_so_far = int(correct_row["correct"] or 0)
        wrong_so_far = answered_count - correct_so_far

        # The node was already decided (failed, or the top node passed) before the
        # student left; don't serve another question, send them to the results.
        if correct_so_far >= PASS_THRESHOLD or wrong_so_far >= FAIL_WRONG_LIMIT:
            return {
                "node_id": current_node,
                "node_label": GRAPH[current_node]["label"],
                "question_text": "",
                "options": [],
                "questions_answered": answered_count,
                "questions_total": QUESTIONS_PER_NODE,
                "correct_count": correct_so_far,
                "wrong_count": wrong_so_far,
                "next_action": "complete",
            }

        # Use a session-seeded deterministic order to avoid repeating probes
        order = _probe_order(session_id, current_node, probes_list)
        probe_idx = order[answered_count % len(probes_list)]
        selected_probe = probes_list[probe_idx]

        await conn.execute(
            "UPDATE sessions SET current_probe_index = $1, last_active_at = $2 WHERE id = $3",
            probe_idx, datetime.now(timezone.utc).isoformat(), session_id,
        )

        return {
            "node_id": current_node,
            "node_label": GRAPH[current_node]["label"],
            "question_text": selected_probe["question_text"],
            "options": selected_probe["options"],
            "questions_answered": answered_count,
            "questions_total": QUESTIONS_PER_NODE,
            "correct_count": correct_so_far,
            "wrong_count": wrong_so_far,
        }
    finally:
        await release_db(conn)


async def _load_battle(conn, session_id, battle_id, student_id):
    row = await conn.fetchrow(
        "SELECT b.*, s.completed AS session_completed, s.current_probe_index "
        "FROM diagnostic_battles b JOIN sessions s ON s.id = b.session_id "
        "WHERE b.id = $1 AND b.session_id = $2 AND s.student_id = $3 FOR UPDATE OF b",
        battle_id, session_id, student_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Diagnostic battle not found")
    return row


async def _save_battle(conn, battle_id, state, request_id, response):
    await conn.execute(
        "UPDATE diagnostic_battles SET state_json = $1, last_request_id = $2, "
        "last_response_json = $3 WHERE id = $4",
        json.dumps(state), request_id, json.dumps(response), battle_id,
    )


@router.post("/{session_id}/battle")
async def start_diagnostic_battle(session_id: str, student=Depends(get_current_student)):
    conn = await get_db()
    try:
        session = await conn.fetchrow(
            "SELECT id, completed FROM sessions WHERE id = $1 AND student_id = $2",
            session_id, student["id"],
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session["completed"]:
            raise HTTPException(status_code=400, detail="Diagnostic session is already completed")
        await conn.execute(DIAGNOSTIC_BATTLE_TABLE_SQL)
        battle_id, state = str(uuid.uuid4()), new_diagnostic_battle()
        await conn.execute(
            "INSERT INTO diagnostic_battles (id, session_id, state_json) VALUES ($1, $2, $3)",
            battle_id, session_id, json.dumps(state),
        )
        return {"battle_id": battle_id, "battle": battle_snapshot(state)}
    finally:
        await release_db(conn)


@router.post("/{session_id}/spell")
async def cast_diagnostic_spell(session_id: str, body: DiagnosticSpellRequest, student=Depends(get_current_student)):
    conn = await get_db()
    try:
        async with conn.transaction():
            row = await _load_battle(conn, session_id, body.battle_id, student["id"])
            if row["last_request_id"] == body.request_id:
                return json.loads(row["last_response_json"])
            state = json.loads(row["state_json"])
            if row["session_completed"] or state["finished"]:
                raise HTTPException(status_code=409, detail="This battle has ended.")
            if row["current_probe_index"] is None:
                raise HTTPException(status_code=409, detail="Fetch the next question before casting.")
            result = resolve_diagnostic_spell(state, body.spell)
            await _save_battle(conn, body.battle_id, state, body.request_id, result)
            return result
    finally:
        await release_db(conn)


@router.post("/{session_id}/answer")
async def submit_diagnostic_answer(session_id: str, body: DiagnosticAnswerRequest, student=Depends(get_current_student)):
    conn = await get_db()
    try:
        async with conn.transaction():
            state = None
            if body.battle_id:
                if not body.request_id:
                    raise HTTPException(status_code=400, detail="A battle answer requires a request ID.")
                row = await _load_battle(conn, session_id, body.battle_id, student["id"])
                if row["last_request_id"] == body.request_id:
                    return json.loads(row["last_response_json"])
                state = json.loads(row["state_json"])
                if state["finished"]:
                    raise HTTPException(status_code=409, detail="This battle has ended.")
            result = await _grade_diagnostic_answer(conn, session_id, body, student)
            if state is not None:
                result["battle"] = resolve_diagnostic_hit(state, result["correct"], result["next_action"])
                await _save_battle(conn, body.battle_id, state, body.request_id, result)
            return result
    finally:
        await release_db(conn)


async def _grade_diagnostic_answer(conn, session_id, body, student):
    """Keep staging assessment rules independent of battle rewards."""
    session_row = await conn.fetchrow(
        "SELECT current_node, current_probe_index, topic_entry_node, completed FROM sessions WHERE id = $1 AND student_id = $2 FOR UPDATE",
        session_id, student["id"],
    )
    if not session_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session_row["completed"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Diagnostic session is already completed")

    current_node = session_row["current_node"]
    probe_idx = session_row["current_probe_index"]

    if probe_idx is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active probe found. Fetch a probe first.")

    if body.node_id != current_node:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submitted node_id '{body.node_id}' does not match current session node '{current_node}'",
        )

    probes_list = PROBES[current_node]
    probe = probes_list[probe_idx]
    is_correct = body.selected_option_index == probe["correct_option_index"]

    log_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    async with conn.transaction():
        await conn.execute(
            """
            INSERT INTO diagnostic_logs (id, session_id, node_id, probe_result, logged_at)
            VALUES ($1, $2, $3, $4, $5)
            """,
            log_id, session_id, current_node, 1 if is_correct else 0, now_iso,
        )

        # Count how many questions now answered for this node
        count_row = await conn.fetchrow(
            "SELECT COUNT(*) as cnt, SUM(probe_result) as correct FROM diagnostic_logs WHERE session_id = $1 AND node_id = $2",
            session_id, current_node,
        )
        answered_count = count_row["cnt"]
        correct_count = int(count_row["correct"] or 0)

        wrong_count = answered_count - correct_count
        node_passed = correct_count >= PASS_THRESHOLD
        node_failed = wrong_count >= FAIL_WRONG_LIMIT

        if not node_passed and not node_failed:
            # Result for this node is still open: ask another question
            await conn.execute(
                "UPDATE sessions SET current_probe_index = NULL, last_active_at = $1 WHERE id = $2",
                now_iso, session_id,
            )
            return {
                "correct": is_correct,
                "next_action": "next_probe",
                "node_complete": False,
                "correct_count": correct_count,
                "wrong_count": wrong_count,
                "questions_answered": answered_count,
                "questions_total": QUESTIONS_PER_NODE,
                "next_node_id": current_node,
                "identified_node_id": None,
                "prerequisite_path": None,
            }

        # ── Node resolved: passed at 3 correct, failed at 2 wrong ────────
        chain = get_chain(session_row["topic_entry_node"])
        reversed_chain = list(reversed(chain))

        current_idx = reversed_chain.index(current_node) if current_node in reversed_chain else -1
        next_node = reversed_chain[current_idx + 1] if current_idx != -1 and current_idx + 1 < len(reversed_chain) else None

        if node_passed and next_node:
            # Passed: move one node up toward the target
            await conn.execute(
                "UPDATE sessions SET current_node = $1, current_probe_index = NULL, last_active_at = $2 WHERE id = $3",
                next_node, now_iso, session_id,
            )
            return {
                "correct": is_correct,
                "next_action": "next_probe",
                "node_complete": True,
                "node_passed": True,
                "correct_count": correct_count,
                "wrong_count": wrong_count,
                "questions_answered": answered_count,
                "questions_total": QUESTIONS_PER_NODE,
                "next_node_id": next_node,
                "identified_node_id": None,
                "prerequisite_path": None,
            }

        # Failed node (stop traversal here) or top node passed: finalize
        prereq_path = get_prerequisite_path(current_node, session_row["topic_entry_node"])
        await conn.execute(
            "UPDATE sessions SET last_active_at = $1, current_probe_index = NULL WHERE id = $2",
            now_iso, session_id,
        )
        return {
            "correct": is_correct,
            "next_action": "complete",
            "node_complete": True,
            "node_passed": node_passed,
            "correct_count": correct_count,
            "wrong_count": wrong_count,
            "questions_answered": answered_count,
            "questions_total": QUESTIONS_PER_NODE,
            "next_node_id": None,
            "identified_node_id": current_node,
            "prerequisite_path": prereq_path,
        }

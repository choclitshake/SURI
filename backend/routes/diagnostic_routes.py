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
)
from backend.graph import GRAPH, get_prerequisite_path
from backend.competency_utils import get_chain, upsert_status, get_status
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

QUESTIONS_PER_NODE = 8
PASS_THRESHOLD = 6  # >= 6/8 (75%) = mastered


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _probe_order(session_id: str, node_id: str, n: int) -> list[int]:
    """Return a deterministic, session-specific shuffled order of probe indices."""
    seed = int(hashlib.md5(f"{session_id}:{node_id}".encode()).hexdigest(), 16)
    rng = random.Random(seed)
    indices = list(range(n))
    rng.shuffle(indices)
    return indices


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
                await upsert_status(conn, student_id, chain[0], "in_progress", "skipped")
                for node_id in chain[1:]:
                    await upsert_status(conn, student_id, node_id, "unresolved", "skipped")

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

            # Find the deepest unresolved node as the learning gap
            gap_node = None
            for node_id in reversed(chain):
                row = await get_status(conn, student_id, node_id)
                if row and row["status"] == "unresolved":
                    gap_node = node_id
                    break

            node_statuses = []
            mastered_nodes = []
            unresolved_nodes = []
            for node_id in chain:
                row = await get_status(conn, student_id, node_id)
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
                    "redirect": "/dashboard",
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

        # Use a session-seeded deterministic order to avoid repeating probes
        order = _probe_order(session_id, current_node, len(probes_list))
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
        }
    finally:
        await release_db(conn)


@router.post("/{session_id}/answer")
async def submit_diagnostic_answer(
    session_id: str,
    body: DiagnosticAnswerRequest,
    student=Depends(get_current_student),
):
    """Submit an answer; track 8 questions per node, require 6/8 for mastery."""
    conn = await get_db()
    try:
        session_row = await conn.fetchrow(
            "SELECT current_node, current_probe_index, topic_entry_node, completed FROM sessions WHERE id = $1 AND student_id = $2",
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

            if answered_count < QUESTIONS_PER_NODE:
                # Not done with this node yet — ask another question
                await conn.execute(
                    "UPDATE sessions SET current_probe_index = NULL, last_active_at = $1 WHERE id = $2",
                    now_iso, session_id,
                )
                return {
                    "correct": is_correct,
                    "next_action": "next_probe",
                    "node_complete": False,
                    "questions_answered": answered_count,
                    "questions_total": QUESTIONS_PER_NODE,
                    "next_node_id": current_node,
                    "identified_node_id": None,
                    "prerequisite_path": None,
                }

            # ── Node complete: 8 questions answered ──────────────────────────
            node_passed = correct_count >= PASS_THRESHOLD
            prereq = GRAPH[current_node]["prerequisite"]

            if prereq:
                # Move to prerequisite node
                await conn.execute(
                    "UPDATE sessions SET current_node = $1, current_probe_index = NULL, last_active_at = $2 WHERE id = $3",
                    prereq, now_iso, session_id,
                )
                return {
                    "correct": is_correct,
                    "next_action": "next_probe",
                    "node_complete": True,
                    "node_passed": node_passed,
                    "correct_count": correct_count,
                    "questions_answered": QUESTIONS_PER_NODE,
                    "questions_total": QUESTIONS_PER_NODE,
                    "next_node_id": prereq,
                    "identified_node_id": None,
                    "prerequisite_path": None,
                }
            else:
                # All nodes assessed — finalize
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
                    "questions_answered": QUESTIONS_PER_NODE,
                    "questions_total": QUESTIONS_PER_NODE,
                    "next_node_id": None,
                    "identified_node_id": current_node,
                    "prerequisite_path": prereq_path,
                }
    finally:
        await release_db(conn)

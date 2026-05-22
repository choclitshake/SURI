"""
Progression routes for SURI.

Mastery-based advance/remediate decisions after a practice round.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_student
from backend.database import get_db
from backend.graph import GRAPH
from backend.competency_utils import (
    upsert_status,
    mark_prerequisites_mastered,
    find_next_upward,
    get_status,
    get_chain,
)
from backend.progress_utils import compute_and_save_session_progress
from backend.models.schemas import ProgressionDecideRequest

router = APIRouter(prefix="/api/progression", tags=["progression"])

PRACTICE_SET_SIZE = 5
PASS_THRESHOLD = 3


@router.post("/decide")
async def decide_progression(
    body: ProgressionDecideRequest,
    student=Depends(get_current_student),
):
    """Decide whether to advance or remediate based on practice mastery."""
    session_id = body.session_id
    node_id = body.node_id

    if node_id not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node_id: '{node_id}'",
        )

    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT id, student_id, topic_entry_node, last_active_at, started_at
            FROM sessions
            WHERE id = ? AND student_id = ?
            """,
            (session_id, student["id"]),
        )
        session_row = await cursor.fetchone()
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        topic_entry_node = session_row["topic_entry_node"]
        student_id = session_row["student_id"]

        cursor = await db.execute(
            """
            SELECT id, passed, attempted_at
            FROM practice_attempts
            WHERE session_id = ? AND node_id = ? AND problem_id != 'batch'
            ORDER BY attempted_at DESC
            LIMIT ?
            """,
            (session_id, node_id, PRACTICE_SET_SIZE),
        )
        attempt_rows = await cursor.fetchall()
        problem_attempt_ids = [row["id"] for row in attempt_rows]

        passed_count = sum(1 for row in attempt_rows if row["passed"] == 1)
        mastery_score = passed_count / PRACTICE_SET_SIZE
        passed = passed_count >= PASS_THRESHOLD

        batch_attempt_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """
            INSERT INTO practice_attempts (
                id, session_id, node_id, problem_id, student_steps_json,
                score, passed, attempted_at
            ) VALUES (?, ?, ?, 'batch', '[]', ?, ?, ?)
            """,
            (
                batch_attempt_id,
                session_id,
                node_id,
                passed_count,
                1 if passed else 0,
                now_iso,
            ),
        )

        if problem_attempt_ids:
            placeholders = ",".join("?" * len(problem_attempt_ids))
            await db.execute(
                f"""
                UPDATE misconception_logs
                SET practice_attempt_id = ?
                WHERE session_id = ?
                  AND practice_attempt_id IN ({placeholders})
                """,
                [batch_attempt_id, session_id, *problem_attempt_ids],
            )

        decision = "advance" if passed else "remediate"
        await db.execute(
            """
            INSERT INTO progression_logs (
                id, session_id, node_id, mastery_score, decision, logged_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                session_id,
                node_id,
                mastery_score,
                decision,
                now_iso,
            ),
        )

        base_response = {
            "decision": decision,
            "mastery_score": mastery_score,
            "passed_count": passed_count,
        }

        if passed:
            await upsert_status(
                db, student_id, node_id, "mastered", "practice"
            )
            await mark_prerequisites_mastered(
                db, student_id, node_id, topic_entry_node
            )

            if node_id == topic_entry_node:
                await db.execute(
                    """
                    UPDATE sessions
                    SET completed = 1, last_active_at = ?
                    WHERE id = ?
                    """,
                    (now_iso, session_id),
                )
                await compute_and_save_session_progress(
                    db, session_id, student_id, topic_entry_node
                )
                await db.commit()
                return {**base_response, "topic_complete": True}

            next_node = await find_next_upward(
                db, student_id, node_id, topic_entry_node
            )

            # Check if all nodes in the chain are mastered
            chain = get_chain(topic_entry_node)
            all_statuses = []
            for n in chain:
                s = await get_status(db, student_id, n)
                all_statuses.append(s['status'] if s else 'unresolved')
            all_mastered = all(s == 'mastered' for s in all_statuses)

            if all_mastered:
                await db.execute(
                    """
                    UPDATE sessions
                    SET completed = 1, last_active_at = ?
                    WHERE id = ?
                    """,
                    (now_iso, session_id),
                )
                await compute_and_save_session_progress(
                    db, session_id, student_id, topic_entry_node
                )
                await db.commit()
                return {**base_response, "topic_complete": True}
            elif next_node is None:
                await db.execute(
                    """
                    UPDATE sessions
                    SET completed = 1, last_active_at = ?
                    WHERE id = ?
                    """,
                    (now_iso, session_id),
                )
                await compute_and_save_session_progress(
                    db, session_id, student_id, topic_entry_node
                )
                await db.commit()
                return {**base_response, "topic_complete": True}

            await upsert_status(
                db, student_id, next_node, "in_progress", "practice"
            )
            await db.execute(
                """
                UPDATE sessions
                SET current_node = ?, last_active_at = ?
                WHERE id = ?
                """,
                (next_node, now_iso, session_id),
            )
            await compute_and_save_session_progress(
                db, session_id, student_id, topic_entry_node
            )
            await db.commit()
            return {
                **base_response,
                "next_node_id": next_node,
                "next_node_label": GRAPH[next_node]["label"],
                "topic_complete": False,
            }

        await upsert_status(
            db, student_id, node_id, "unresolved", "practice"
        )

        round_start = (
            min(row["attempted_at"] for row in attempt_rows)
            if attempt_rows
            else session_row["started_at"]
        )
        cursor = await db.execute(
            """
            SELECT DISTINCT mapped_node_id
            FROM misconception_logs
            WHERE session_id = ? AND logged_at >= ?
            """,
            (session_id, round_start),
        )
        misconception_rows = await cursor.fetchall()
        misconception_nodes = [
            {
                "node_id": row["mapped_node_id"],
                "node_label": GRAPH[row["mapped_node_id"]]["label"],
            }
            for row in misconception_rows
            if row["mapped_node_id"] != node_id
            and row["mapped_node_id"] in GRAPH
        ]

        prereq = GRAPH[node_id]["prerequisite"]
        go_deeper_available = prereq is not None
        go_deeper_node = None
        if go_deeper_available:
            await upsert_status(
                db, student_id, prereq, "in_progress", "practice"
            )
            go_deeper_node = {
                "node_id": prereq,
                "node_label": GRAPH[prereq]["label"],
            }

        await db.execute(
            "UPDATE sessions SET last_active_at = ? WHERE id = ?",
            (now_iso, session_id),
        )
        await compute_and_save_session_progress(
            db, session_id, student_id, topic_entry_node
        )
        await db.commit()

        return {
            **base_response,
            "misconception_nodes": misconception_nodes,
            "go_deeper_available": go_deeper_available,
            "go_deeper_node": go_deeper_node,
        }
    finally:
        await db.close()

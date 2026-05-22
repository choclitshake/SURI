"""
Progression routes for SURI.

Mastery-based advance/remediate decisions after a practice round.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_student
from backend.database import get_db
from backend.graph import GRAPH, find_next_node_toward_entry
from backend.models.schemas import ProgressionDecideRequest

router = APIRouter(prefix="/api/progression", tags=["progression"])

PRACTICE_SET_SIZE = 5
MASTERY_THRESHOLD = 0.60


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
            SELECT id, student_id, topic_entry_node, current_node
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
            SELECT id, passed, score
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
        passed = mastery_score >= MASTERY_THRESHOLD

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
        progression_id = str(uuid.uuid4())
        await db.execute(
            """
            INSERT INTO progression_logs (
                id, session_id, node_id, mastery_score, decision, logged_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                progression_id,
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
            competency_id = str(uuid.uuid4())
            cursor = await db.execute(
                """
                SELECT id FROM competency_status
                WHERE student_id = ? AND node_id = ?
                """,
                (student_id, node_id),
            )
            existing_competency = await cursor.fetchone()
            if existing_competency:
                await db.execute(
                    """
                    UPDATE competency_status
                    SET status = 'mastered', updated_at = ?
                    WHERE student_id = ? AND node_id = ?
                    """,
                    (now_iso, student_id, node_id),
                )
            else:
                await db.execute(
                    """
                    INSERT INTO competency_status (
                        id, student_id, node_id, status, updated_at
                    ) VALUES (?, ?, ?, 'mastered', ?)
                    """,
                    (competency_id, student_id, node_id, now_iso),
                )

            next_node_id = find_next_node_toward_entry(node_id, topic_entry_node)

            if next_node_id:
                await db.execute(
                    """
                    UPDATE sessions
                    SET current_node = ?, last_active_at = ?
                    WHERE id = ?
                    """,
                    (next_node_id, now_iso, session_id),
                )
                await db.commit()
                return {
                    **base_response,
                    "next_node_id": next_node_id,
                    "next_node_label": GRAPH[next_node_id]["label"],
                    "topic_complete": False,
                }

            await db.execute(
                """
                UPDATE sessions
                SET completed = 1, last_active_at = ?
                WHERE id = ?
                """,
                (now_iso, session_id),
            )
            await db.commit()
            return {
                **base_response,
                "topic_complete": True,
            }

        cursor = await db.execute(
            """
            SELECT DISTINCT mapped_node_id
            FROM misconception_logs
            WHERE practice_attempt_id = ?
            """,
            (batch_attempt_id,),
        )
        misconception_rows = await cursor.fetchall()
        misconception_nodes = [
            {
                "node_id": row["mapped_node_id"],
                "node_label": GRAPH[row["mapped_node_id"]]["label"],
            }
            for row in misconception_rows
            if row["mapped_node_id"] != node_id and row["mapped_node_id"] in GRAPH
        ]

        prereq = GRAPH[node_id]["prerequisite"]
        go_deeper_available = prereq is not None
        go_deeper_node = None
        if go_deeper_available:
            go_deeper_node = {
                "node_id": prereq,
                "node_label": GRAPH[prereq]["label"],
            }

        await db.execute(
            "UPDATE sessions SET last_active_at = ? WHERE id = ?",
            (now_iso, session_id),
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

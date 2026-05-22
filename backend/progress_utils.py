"""
Session completion percentage from competency_status along the topic chain.
"""

from datetime import datetime, timezone

from backend.competency_utils import get_chain


async def compute_and_save_session_progress(
    db, session_id: str, student_id: str, topic_entry_node: str
) -> dict:
    """Recompute completion_percentage from mastered nodes in chain."""
    chain = get_chain(topic_entry_node)
    total_in_chain = len(chain)
    if total_in_chain == 0:
        completion_percentage = 0.0
        mastered_in_chain = 0
    else:
        placeholders = ",".join("?" * len(chain))
        cursor = await db.execute(
            f"""
            SELECT COUNT(*) AS cnt FROM competency_status
            WHERE student_id = ? AND node_id IN ({placeholders})
              AND status = 'mastered'
            """,
            [student_id, *chain],
        )
        row = await cursor.fetchone()
        mastered_in_chain = row["cnt"] if row else 0
        completion_percentage = round(
            mastered_in_chain / total_in_chain * 100, 1
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """
        UPDATE sessions
        SET completion_percentage = ?, last_active_at = ?
        WHERE id = ? AND student_id = ?
        """,
        (completion_percentage, now_iso, session_id, student_id),
    )
    return {
        "success": True,
        "completion_percentage": completion_percentage,
        "mastered_in_chain": mastered_in_chain,
        "total_in_chain": total_in_chain,
    }

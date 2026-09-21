"""
Session completion percentage from competency_status along the topic chain.
"""

from datetime import datetime, timezone

from backend.competency_utils import get_chain


async def compute_and_save_session_progress(
    conn, session_id: str, student_id: str, topic_entry_node: str
) -> dict:
    """Recompute completion_percentage from mastered nodes in chain."""
    chain = get_chain(topic_entry_node)
    total_in_chain = len(chain)
    if total_in_chain == 0:
        completion_percentage = 0.0
        mastered_in_chain = 0
    else:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS cnt FROM competency_status
            WHERE student_id = $1 AND node_id = ANY($2)
              AND status = 'mastered'
            """,
            student_id, chain,
        )
        mastered_in_chain = row["cnt"] if row else 0
        completion_percentage = round(
            mastered_in_chain / total_in_chain * 100, 1
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        """
        UPDATE sessions
        SET completion_percentage = $1, last_active_at = $2
        WHERE id = $3 AND student_id = $4
        """,
        completion_percentage, now_iso, session_id, student_id,
    )
    return {
        "success": True,
        "completion_percentage": completion_percentage,
        "mastered_in_chain": mastered_in_chain,
        "total_in_chain": total_in_chain,
    }

"""
Single source of truth for competency_status reads and writes.
"""

import uuid
from datetime import datetime, timezone

from backend.graph import GRAPH

# Strongest → weakest; never downgrade practice-mastered with weaker sources.
_PRACTICE_MASTERED = frozenset({"practice"})


def get_chain(entry_node_id: str) -> list[str]:
    """Ordered chain from entry node (index 0) down to floor (last index)."""
    chain = []
    current = entry_node_id
    while current is not None:
        chain.append(current)
        current = GRAPH[current]["prerequisite"]
    return chain


async def upsert_status(
    conn,
    student_id: str,
    node_id: str,
    status: str,
    source: str,
):
    """Upsert a single competency_status record."""
    existing = await conn.fetchrow(
        """
        SELECT id FROM competency_status
        WHERE student_id = $1 AND node_id = $2
        """,
        student_id, node_id,
    )
    record_id = existing["id"] if existing else str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    await conn.execute(
        """
        INSERT INTO competency_status (id, student_id, node_id, status, source, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, node_id) DO UPDATE SET
            id = EXCLUDED.id,
            status = EXCLUDED.status,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
        """,
        record_id, student_id, node_id, status, source, now_iso,
    )


async def get_status(conn, student_id: str, node_id: str) -> dict | None:
    """Return { status, source } for a student+node, or None."""
    row = await conn.fetchrow(
        """
        SELECT status, source FROM competency_status
        WHERE student_id = $1 AND node_id = $2
        """,
        student_id, node_id,
    )
    if row:
        return {"status": row["status"], "source": row["source"]}
    return None


async def mark_prerequisites_mastered(
    conn, student_id: str, passed_node_id: str, entry_node_id: str
):
    """
    Mark prerequisite nodes below passed_node_id as mastered (implied).
    Does not overwrite practice-sourced mastered records.
    """
    chain = get_chain(entry_node_id)
    if passed_node_id not in chain:
        return
    passed_index = chain.index(passed_node_id)
    for node_id in chain[passed_index + 1:]:
        existing = await get_status(conn, student_id, node_id)
        if (
            existing
            and existing["status"] == "mastered"
            and existing["source"] in _PRACTICE_MASTERED
        ):
            continue
        await upsert_status(conn, student_id, node_id, "mastered", "implied")


async def find_next_upward(
    conn, student_id: str, current_node_id: str, entry_node_id: str
) -> str | None:
    """
    First node toward entry (lower index) that is not yet mastered.
    None if all nodes above current are mastered.
    """
    chain = get_chain(entry_node_id)
    if current_node_id not in chain:
        return None
    current_index = chain.index(current_node_id)
    for i in range(current_index - 1, -1, -1):
        existing = await get_status(conn, student_id, chain[i])
        if not existing or existing["status"] != "mastered":
            return chain[i]
    return None

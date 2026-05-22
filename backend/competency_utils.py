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
    db,
    student_id: str,
    node_id: str,
    status: str,
    source: str,
):
    """Upsert a single competency_status record."""
    cursor = await db.execute(
        """
        SELECT id FROM competency_status
        WHERE student_id = ? AND node_id = ?
        """,
        (student_id, node_id),
    )
    existing = await cursor.fetchone()
    record_id = existing["id"] if existing else str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.execute(
        """
        INSERT OR REPLACE INTO competency_status
        (id, student_id, node_id, status, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (record_id, student_id, node_id, status, source, now_iso),
    )


async def get_status(db, student_id: str, node_id: str) -> dict | None:
    """Return { status, source } for a student+node, or None."""
    cursor = await db.execute(
        """
        SELECT status, source FROM competency_status
        WHERE student_id = ? AND node_id = ?
        """,
        (student_id, node_id),
    )
    row = await cursor.fetchone()
    if row:
        return {"status": row["status"], "source": row["source"]}
    return None


async def mark_prerequisites_mastered(
    db, student_id: str, passed_node_id: str, entry_node_id: str
):
    """
    Mark prerequisite nodes below passed_node_id as mastered (implied).
    Does not overwrite practice-sourced mastered records.
    """
    chain = get_chain(entry_node_id)
    if passed_node_id not in chain:
        return
    passed_index = chain.index(passed_node_id)
    for node_id in chain[passed_index + 1 :]:
        existing = await get_status(db, student_id, node_id)
        if (
            existing
            and existing["status"] == "mastered"
            and existing["source"] in _PRACTICE_MASTERED
        ):
            continue
        await upsert_status(db, student_id, node_id, "mastered", "implied")


async def find_next_upward(
    db, student_id: str, current_node_id: str, entry_node_id: str
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
        existing = await get_status(db, student_id, chain[i])
        if not existing or existing["status"] != "mastered":
            return chain[i]
    return None

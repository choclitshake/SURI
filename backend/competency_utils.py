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
    """
    Upsert a single competency_status record in ONE round trip.

    The "never downgrade a mastered status" rule used to require a SELECT
    before the write. It's now enforced directly in the ON CONFLICT ...
    WHERE clause, so the write is skipped at the DB level instead of in
    application code. The existing row's `id` is left untouched on
    conflict (it's simply omitted from the SET list), which preserves the
    same "id stays stable across updates" behavior the old SELECT-first
    version had.
    """
    record_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    await conn.execute(
        """
        INSERT INTO competency_status (id, student_id, node_id, status, source, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, node_id) DO UPDATE SET
            status = EXCLUDED.status,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
        WHERE NOT (
            competency_status.status = 'mastered'
            AND EXCLUDED.status != 'mastered'
        )
        """,
        record_id, student_id, node_id, status, source, now_iso,
    )


async def batch_upsert_statuses(
    conn,
    entries: list[tuple[str, str, str, str]],
):
    """
    Batched version of upsert_status: ONE round trip (executemany) for
    multiple (student_id, node_id, status, source) writes instead of one
    round trip per node. Same ON CONFLICT ... WHERE guard as upsert_status,
    so a mastered status is never downgraded by a batched write either.
    """
    if not entries:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    records = [
        (str(uuid.uuid4()), student_id, node_id, status, source, now_iso)
        for student_id, node_id, status, source in entries
    ]

    await conn.executemany(
        """
        INSERT INTO competency_status (id, student_id, node_id, status, source, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, node_id) DO UPDATE SET
            status = EXCLUDED.status,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
        WHERE NOT (
            competency_status.status = 'mastered'
            AND EXCLUDED.status != 'mastered'
        )
        """,
        records,
    )


async def get_status(conn, student_id: str, node_id: str) -> dict | None:
    """Return { status, source } for a single student+node, or None."""
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


async def get_statuses(conn, student_id: str, node_ids: list[str]) -> dict[str, dict]:
    """
    Batched version of get_status: ONE round trip for a whole set of nodes.
    Returns {node_id: {status, source}}; nodes with no record are simply
    absent from the dict (caller treats that the same as None).
    """
    if not node_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT node_id, status, source FROM competency_status
        WHERE student_id = $1 AND node_id = ANY($2)
        """,
        student_id, node_ids,
    )
    return {
        row["node_id"]: {"status": row["status"], "source": row["source"]}
        for row in rows
    }


async def mark_prerequisites_mastered(
    conn, student_id: str, passed_node_id: str, entry_node_id: str
):
    """
    Mark prerequisite nodes below passed_node_id as mastered (implied).
    Does not overwrite practice-sourced mastered records.

    Was: 1 get_status + up to 2 upsert round trips PER NODE in the slice.
    Now: 1 read (get_statuses) + at most 1 multi-row write, total.
    """
    chain = get_chain(entry_node_id)
    if passed_node_id not in chain:
        return
    passed_index = chain.index(passed_node_id)
    remaining = chain[passed_index + 1:]
    if not remaining:
        return

    existing_map = await get_statuses(conn, student_id, remaining)

    to_upsert = [
        node_id
        for node_id in remaining
        if not (
            (existing := existing_map.get(node_id))
            and existing["status"] == "mastered"
            and existing["source"] in _PRACTICE_MASTERED
        )
    ]
    if not to_upsert:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    records = [
        (str(uuid.uuid4()), student_id, node_id, "mastered", "implied", now_iso)
        for node_id in to_upsert
    ]

    await conn.executemany(
        """
        INSERT INTO competency_status (id, student_id, node_id, status, source, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, node_id) DO UPDATE SET
            status = EXCLUDED.status,
            source = EXCLUDED.source,
            updated_at = EXCLUDED.updated_at
        WHERE NOT (
            competency_status.status = 'mastered'
            AND EXCLUDED.status != 'mastered'
        )
        """,
        records,
    )


async def find_next_upward(
    conn, student_id: str, current_node_id: str, entry_node_id: str
) -> str | None:
    """
    First node toward entry (lower index) that is not yet mastered.
    None if all nodes above current are mastered.

    Was: 1 get_status round trip PER NODE scanned upward.
    Now: 1 read for the whole upward slice, then scan in Python.
    """
    chain = get_chain(entry_node_id)
    if current_node_id not in chain:
        return None
    current_index = chain.index(current_node_id)
    upward_slice = chain[:current_index]
    if not upward_slice:
        return None

    existing_map = await get_statuses(conn, student_id, upward_slice)

    for i in range(current_index - 1, -1, -1):
        existing = existing_map.get(chain[i])
        if not existing or existing["status"] != "mastered":
            return chain[i]
    return None
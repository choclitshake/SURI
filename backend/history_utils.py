"""Helpers for writing history_logs rows."""

import uuid
from datetime import datetime, timezone
from typing import Optional


async def log_history(
    conn,
    *,
    student_id: str,
    kind: str,
    node_id: str,
    session_id: Optional[str] = None,
    score: Optional[int] = None,
    total_correct: Optional[int] = None,
    total_steps: Optional[int] = None,
    passed_count: Optional[int] = None,
    passed: Optional[bool] = None,
    decision: Optional[str] = None,
    page_key: Optional[str] = None,
    checked: Optional[bool] = None,
    logged_at: Optional[str] = None,
) -> str:
    """Insert one row into history_logs and return its id."""
    log_id = str(uuid.uuid4())
    await conn.execute(
        """
        INSERT INTO history_logs (
            id, student_id, session_id, kind, node_id,
            score, total_correct, total_steps, passed_count, passed, decision,
            page_key, checked, logged_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        """,
        log_id, student_id, session_id, kind, node_id,
        score, total_correct, total_steps, passed_count, passed, decision,
        page_key, checked,
        logged_at or datetime.now(timezone.utc).isoformat(),
    )
    return log_id
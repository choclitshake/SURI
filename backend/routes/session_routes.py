import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from backend.auth import get_current_student
from backend.database import get_db, release_db
from backend.models.schemas import (
    CreateSessionRequest,
    UpdateSessionRequest,
)
from backend.graph import GRAPH
from backend.progress_utils import compute_and_save_session_progress

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("")
async def create_session(body: CreateSessionRequest, student=Depends(get_current_student)):
    """Create a new learning session."""
    if body.topic_entry_node not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic_entry_node: '{body.topic_entry_node}'"
        )

    student_id = student["id"]
    conn = await get_db()
    try:
        # Check for existing active session
        existing = await conn.fetchrow(
            """
            SELECT id, current_node FROM sessions
            WHERE student_id = $1 AND topic_entry_node = $2 AND completed = 0
            LIMIT 1
            """,
            student_id, body.topic_entry_node,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "session_exists", "session_id": existing["id"], "current_node": existing["current_node"]}
            )

        session_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        await conn.execute(
            """
            INSERT INTO sessions (
                id, student_id, topic_entry_node, current_node,
                current_probe_index, started_at, last_active_at,
                completed, completion_percentage
            ) VALUES ($1, $2, $3, $4, NULL, $5, $6, 0, 0.0)
            """,
            session_id, student_id, body.topic_entry_node,
            body.topic_entry_node, now_iso, now_iso,
        )
    finally:
        await release_db(conn)

    return {
        "id": session_id,
        "session_id": session_id,
        "topic_entry_node": body.topic_entry_node,
        "current_node": body.topic_entry_node,
    }


@router.get("/{session_id}")
async def get_session(session_id: str, student=Depends(get_current_student)):
    """Get session details."""
    conn = await get_db()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM sessions WHERE id = $1 AND student_id = $2",
            session_id, student["id"],
        )
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        return dict(row)
    finally:
        await release_db(conn)


@router.patch("/{session_id}")
async def update_session(
    session_id: str,
    body: UpdateSessionRequest,
    student=Depends(get_current_student),
):
    """Update session state."""
    if body.current_node is not None and body.current_node not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid current_node: '{body.current_node}'",
        )

    conn = await get_db()
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM sessions WHERE id = $1 AND student_id = $2",
            session_id, student["id"],
        )
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        updates = []
        params = []
        param_idx = 1

        if body.current_node is not None:
            updates.append(f"current_node = ${param_idx}")
            params.append(body.current_node)
            param_idx += 1
        if body.completed is not None:
            updates.append(f"completed = ${param_idx}")
            params.append(body.completed)
            param_idx += 1

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        updates.append(f"last_active_at = ${param_idx}")
        params.append(now_iso)
        param_idx += 1

        params.append(session_id)
        params.append(student["id"])

        await conn.execute(
            f"UPDATE sessions SET {', '.join(updates)} WHERE id = ${param_idx} AND student_id = ${param_idx + 1}",
            *params,
        )

        row = await conn.fetchrow(
            "SELECT * FROM sessions WHERE id = $1", session_id
        )
        return dict(row)
    finally:
        await release_db(conn)


@router.patch("/{session_id}/progress")
async def update_progress(
    session_id: str,
    student=Depends(get_current_student),
):
    """Recompute and persist session completion from competency mastery."""
    conn = await get_db()
    try:
        session_row = await conn.fetchrow(
            """
            SELECT id, student_id, topic_entry_node
            FROM sessions WHERE id = $1 AND student_id = $2
            """,
            session_id, student["id"],
        )
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        result = await compute_and_save_session_progress(
            conn,
            session_id,
            session_row["student_id"],
            session_row["topic_entry_node"],
        )
        return result
    finally:
        await release_db(conn)

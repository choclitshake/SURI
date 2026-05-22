import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from backend.auth import get_current_student
from backend.database import get_db
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
    db = await get_db()
    try:
        # Check for existing active session
        cursor = await db.execute(
            """
            SELECT id, current_node FROM sessions 
            WHERE student_id = ? AND topic_entry_node = ? AND completed = 0
            LIMIT 1
            """,
            (student_id, body.topic_entry_node),
        )
        existing = await cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "session_exists", "session_id": existing["id"], "current_node": existing["current_node"]}
            )

        session_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        await db.execute(
            """
            INSERT INTO sessions (
                id, student_id, topic_entry_node, current_node, 
                current_probe_index, started_at, last_active_at, 
                completed, completion_percentage
            ) VALUES (?, ?, ?, ?, NULL, ?, ?, 0, 0.0)
            """,
            (
                session_id,
                student_id,
                body.topic_entry_node,
                body.topic_entry_node,
                now_iso,
                now_iso,
            ),
        )
        await db.commit()
    finally:
        await db.close()

    return {
        "id": session_id,
        "session_id": session_id,
        "topic_entry_node": body.topic_entry_node,
        "current_node": body.topic_entry_node,
    }


@router.get("/{session_id}")
async def get_session(session_id: str, student=Depends(get_current_student)):
    """Get session details."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id = ? AND student_id = ?",
            (session_id, student["id"]),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        return dict(row)
    finally:
        await db.close()


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

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM sessions WHERE id = ? AND student_id = ?",
            (session_id, student["id"]),
        )
        if not await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        updates = []
        params = []
        if body.current_node is not None:
            updates.append("current_node = ?")
            params.append(body.current_node)
        if body.completed is not None:
            updates.append("completed = ?")
            params.append(body.completed)

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        updates.append("last_active_at = ?")
        params.append(now_iso)
        params.append(session_id)
        params.append(student["id"])

        await db.execute(
            f"UPDATE sessions SET {', '.join(updates)} WHERE id = ? AND student_id = ?",
            params,
        )
        await db.commit()

        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (session_id,),
        )
        return dict(await cursor.fetchone())
    finally:
        await db.close()


@router.patch("/{session_id}/progress")
async def update_progress(
    session_id: str,
    student=Depends(get_current_student),
):
    """Recompute and persist session completion from competency mastery."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT id, student_id, topic_entry_node
            FROM sessions WHERE id = ? AND student_id = ?
            """,
            (session_id, student["id"]),
        )
        session_row = await cursor.fetchone()
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        result = await compute_and_save_session_progress(
            db,
            session_id,
            session_row["student_id"],
            session_row["topic_entry_node"],
        )
        await db.commit()
        return result
    finally:
        await db.close()

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from backend.auth import get_current_student
from backend.database import get_db
from backend.models.schemas import CreateSessionRequest
from backend.graph import GRAPH

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("")
async def create_session(body: CreateSessionRequest, student=Depends(get_current_student)):
    """Create a new learning session."""
    if body.topic_entry_node not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic_entry_node: '{body.topic_entry_node}'"
        )

    session_id = str(uuid.uuid4())
    student_id = student["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    db = await get_db()
    try:
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
async def update_session(session_id: str, student=Depends(get_current_student)):
    """Update session state."""
    return {"message": "Not implemented yet"}


@router.patch("/{session_id}/progress")
async def update_progress(session_id: str, student=Depends(get_current_student)):
    """Update session progress."""
    return {"message": "Not implemented yet"}

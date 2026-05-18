"""
Session routes (placeholder — to be implemented in a later session).
"""

from fastapi import APIRouter, Depends
from backend.auth import get_current_student

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("")
async def create_session(student=Depends(get_current_student)):
    """Create a new learning session."""
    return {"message": "Not implemented yet"}


@router.get("/{session_id}")
async def get_session(session_id: str, student=Depends(get_current_student)):
    """Get session details."""
    return {"message": "Not implemented yet"}


@router.patch("/{session_id}")
async def update_session(session_id: str, student=Depends(get_current_student)):
    """Update session state."""
    return {"message": "Not implemented yet"}


@router.patch("/{session_id}/progress")
async def update_progress(session_id: str, student=Depends(get_current_student)):
    """Update session progress."""
    return {"message": "Not implemented yet"}

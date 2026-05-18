"""
Diagnostic routes (placeholder — to be implemented in a later session).
"""

from fastapi import APIRouter, Depends
from backend.auth import get_current_student

router = APIRouter(prefix="/api/diagnostic", tags=["diagnostic"])


@router.get("/{session_id}/probe")
async def get_diagnostic_probe(session_id: str, student=Depends(get_current_student)):
    """Get the next diagnostic probe question."""
    return {"message": "Not implemented yet"}


@router.post("/{session_id}/answer")
async def submit_diagnostic_answer(session_id: str, student=Depends(get_current_student)):
    """Submit an answer to a diagnostic probe."""
    return {"message": "Not implemented yet"}

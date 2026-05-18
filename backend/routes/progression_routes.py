"""
Progression routes (placeholder — to be implemented in a later session).
"""

from fastapi import APIRouter, Depends
from backend.auth import get_current_student

router = APIRouter(prefix="/api/progression", tags=["progression"])


@router.post("/decide")
async def decide_progression(student=Depends(get_current_student)):
    """Decide whether to advance or remediate based on mastery."""
    return {"message": "Not implemented yet"}

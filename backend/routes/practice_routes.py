"""
Practice routes (placeholder — to be implemented in a later session).
"""

from fastapi import APIRouter, Depends
from backend.auth import get_current_student

router = APIRouter(prefix="/api/practice", tags=["practice"])


@router.post("/start")
async def start_practice(student=Depends(get_current_student)):
    """Start a practice problem set for a node."""
    return {"message": "Not implemented yet"}


@router.post("/submit-step")
async def submit_step(student=Depends(get_current_student)):
    """Submit a single step in a practice problem."""
    return {"message": "Not implemented yet"}

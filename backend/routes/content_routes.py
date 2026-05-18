"""
Content generation routes (placeholder — to be implemented in a later session).
"""

from fastapi import APIRouter, Depends
from backend.auth import get_current_student

router = APIRouter(prefix="/api/content", tags=["content"])


@router.post("/generate")
async def generate_content(student=Depends(get_current_student)):
    """Generate lesson content for a topic node."""
    return {"message": "Not implemented yet"}

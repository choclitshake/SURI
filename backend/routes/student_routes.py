"""
Student and topic routes (placeholder — to be implemented in a later session).
"""

from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_student
from backend.graph import GRAPH, ENTRY_NODES

router = APIRouter(prefix="/api", tags=["students", "topics"])


@router.get("/topics")
async def list_topics(student=Depends(get_current_student)):
    """List all available entry topics."""
    topics = []
    for node_id in ENTRY_NODES:
        node = GRAPH[node_id]
        topics.append({
            "node_id": node_id,
            "label": node["label"],
            "grade": node["grade"],
        })
    return topics


@router.get("/topics/{node_id}/intro")
async def get_topic_intro(node_id: str, student=Depends(get_current_student)):
    """Get introductory info for a topic."""
    if node_id not in GRAPH:
        raise HTTPException(status_code=404, detail="Topic not found")
    node = GRAPH[node_id]
    return {
        "node_id": node_id,
        "label": node["label"],
        "grade": node["grade"],
        "intro_text": f"This topic covers {node['label']} at the Grade {node['grade']} level. A full lesson will be generated for you."
    }


@router.get("/students/{student_id}/progress")
async def get_student_progress(student_id: str, student=Depends(get_current_student)):
    """Get a student's progress across all competencies."""
    return {"message": "Not implemented yet"}

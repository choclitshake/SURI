"""
Student and topic routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from backend.auth import get_current_student
from backend.database import get_db
from backend.graph import GRAPH, ENTRY_NODES
from backend.competency_utils import get_chain

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


@router.get("/topics/{node_id}/chain")
async def get_topic_chain(node_id: str, student=Depends(get_current_student)):
    """Return prerequisite chain from entry node down to floor."""
    if node_id not in GRAPH:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"chain": get_chain(node_id)}


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
async def get_student_progress(
    student_id: str, student=Depends(get_current_student)
):
    """Get active sessions and misconception history for the dashboard."""
    if student_id != student["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot view another student's progress",
        )

    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT * FROM sessions
            WHERE student_id = ? AND completed = 0
            ORDER BY last_active_at DESC
            """,
            (student_id,),
        )
        session_rows = await cursor.fetchall()
        active_sessions = []

        for session_row in session_rows:
            topic_entry_node = session_row["topic_entry_node"]
            current_node = session_row["current_node"]
            chain = get_chain(topic_entry_node)
            total_in_chain = len(chain)

            if chain:
                placeholders = ",".join("?" * len(chain))
                cursor = await db.execute(
                    f"""
                    SELECT node_id, status, source FROM competency_status
                    WHERE student_id = ? AND node_id IN ({placeholders})
                    """,
                    [student_id, *chain],
                )
                status_rows = await cursor.fetchall()
            else:
                status_rows = []

            mastered_nodes = []
            in_progress_nodes = []
            unresolved_nodes = []

            for row in status_rows:
                nid = row["node_id"]
                item = {
                    "node_id": nid,
                    "node_label": GRAPH[nid]["label"],
                    "source": row["source"],
                }
                if row["status"] == "mastered":
                    mastered_nodes.append(item)
                elif row["status"] == "in_progress":
                    in_progress_nodes.append(item)
                elif row["status"] == "unresolved":
                    unresolved_nodes.append({**item})

            diagnostic_count = sum(
                1 for n in mastered_nodes if n["source"] == "diagnostic"
            )
            practice_count = sum(
                1
                for n in mastered_nodes
                if n["source"] in ("practice", "implied")
            )

            session_dict = dict(session_row)
            session_dict.update({
                "topic_label": GRAPH[topic_entry_node]["label"],
                "current_node_label": GRAPH[current_node]["label"],
                "total_in_chain": total_in_chain,
                "mastered_count": len(mastered_nodes),
                "diagnostic_count": diagnostic_count,
                "practice_count": practice_count,
                "mastered_nodes": mastered_nodes,
                "in_progress_nodes": in_progress_nodes,
                "unresolved_nodes": unresolved_nodes,
            })
            active_sessions.append(session_dict)

        session_ids = [s["id"] for s in active_sessions]
        misconception_history = []
        if session_ids:
            placeholders = ",".join("?" * len(session_ids))
            cursor = await db.execute(
                f"""
                SELECT mapped_node_id, step_description, logged_at
                FROM misconception_logs
                WHERE session_id IN ({placeholders})
                ORDER BY logged_at DESC
                LIMIT 20
                """,
                session_ids,
            )
            for row in await cursor.fetchall():
                mapped = row["mapped_node_id"]
                if mapped not in GRAPH:
                    continue
                misconception_history.append({
                    "node_id": mapped,
                    "node_label": GRAPH[mapped]["label"],
                    "step_description": row["step_description"],
                    "logged_at": row["logged_at"],
                })

        return {
            "active_sessions": active_sessions,
            "misconception_history": misconception_history,
        }
    finally:
        await db.close()

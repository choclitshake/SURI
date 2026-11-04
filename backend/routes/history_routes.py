"""
History routes for SURI: persisted topic-page checkoffs.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_student
from backend.database import get_db, release_db
from backend.graph import GRAPH
from backend.history_utils import log_history
from backend.models.schemas import TopicCheckRequest, TopicChecksResponse
from datetime import datetime, timezone
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from backend.models.schemas import (
    TopicCheckRequest, TopicChecksResponse,
    HistoryLogsResponse, HistorySummaryResponse,
)

router = APIRouter(prefix="/api/history", tags=["history"])


async def _checked_pages(conn, student_id: str, node_id: str) -> list[str]:
    rows = await conn.fetch(
        "SELECT page_key FROM topic_checks "
        "WHERE student_id = $1 AND node_id = $2 AND checked = TRUE",
        student_id, node_id,
    )
    return [r["page_key"] for r in rows]


@router.get("/topic-checks/{node_id}", response_model=TopicChecksResponse)
async def get_topic_checks(node_id: str, student=Depends(get_current_student)):
    """Which pages of this topic the student has checked off."""
    if node_id not in GRAPH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid node_id: '{node_id}'")
    conn = await get_db()
    try:
        return {"node_id": node_id, "checked_pages": await _checked_pages(conn, student["id"], node_id)}
    finally:
        await release_db(conn)


@router.post("/topic-check", response_model=TopicChecksResponse)
async def set_topic_check(body: TopicCheckRequest, student=Depends(get_current_student)):
    """Save a page's checked state and log the change (only if it changed)."""
    if body.node_id not in GRAPH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid node_id: '{body.node_id}'")

    conn = await get_db()
    try:
        owned = await conn.fetchrow(
            "SELECT id FROM sessions WHERE id = $1 AND student_id = $2",
            body.session_id, student["id"],
        )
        if not owned:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        now_iso = datetime.now(timezone.utc).isoformat()
        await conn.execute(
            """
            INSERT INTO topic_checks (student_id, node_id, page_key, checked, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id, node_id, page_key)
            DO UPDATE SET checked = EXCLUDED.checked, updated_at = EXCLUDED.updated_at
            """,
            student["id"], body.node_id, body.page_key, body.checked, now_iso,
        )

        return {"node_id": body.node_id, "checked_pages": await _checked_pages(conn, student["id"], body.node_id)}
    finally:
        await release_db(conn)
        
        
HISTORY_COLUMNS = (
    "id, kind, node_id, session_id, logged_at, score, total_correct, total_steps, "
    "passed_count, passed, decision, page_key, checked"
)


@router.get("", response_model=HistoryLogsResponse)
async def list_history(
    kind: Optional[Literal["quiz", "practice", "topic_check"]] = None,
    node_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    student=Depends(get_current_student),
):
    """Newest-first activity feed for the current student."""
    if kind == "topic_check":
        tc_conditions, tc_params = ["student_id = $1", "checked = TRUE"], [student["id"]]
        if node_id:
            tc_params.append(node_id)
            tc_conditions.append(f"node_id = ${len(tc_params)}")
        tc_where = " AND ".join(tc_conditions)

        conn = await get_db()
        try:
            total = await conn.fetchval(f"SELECT COUNT(*) FROM topic_checks WHERE {tc_where}", *tc_params)
            rows = await conn.fetch(
                f"SELECT node_id, page_key, checked, updated_at FROM topic_checks WHERE {tc_where} "
                f"ORDER BY updated_at DESC, node_id, page_key "
                f"LIMIT ${len(tc_params) + 1} OFFSET ${len(tc_params) + 2}",
                *tc_params, limit + 1, offset,
            )
        finally:
            await release_db(conn)

        items = [
            {
                "id": f"{r['node_id']}:{r['page_key']}",
                "kind": "topic_check",
                "node_id": r["node_id"],
                "node_label": GRAPH.get(r["node_id"], {}).get("label", r["node_id"]),
                "session_id": None,
                "logged_at": r["updated_at"],
                "score": None,
                "total_correct": None,
                "total_steps": None,
                "passed_count": None,
                "passed": None,
                "decision": None,
                "page_key": r["page_key"],
                "checked": r["checked"],
            }
            for r in rows[:limit]
        ]
        return {
            "items": items,
            "next_offset": offset + limit if len(rows) > limit else None,
            "total": total,
        }
        
    conditions, params = ["student_id = $1"], [student["id"]]
    if kind:
        params.append(kind)
        conditions.append(f"kind = ${len(params)}")
    if node_id:
        params.append(node_id)
        conditions.append(f"node_id = ${len(params)}")
    where = " AND ".join(conditions)

    conn = await get_db()
    try:
        total = await conn.fetchval(f"SELECT COUNT(*) FROM history_logs WHERE {where}", *params)
        rows = await conn.fetch(
            f"SELECT {HISTORY_COLUMNS} FROM history_logs WHERE {where} "
            f"ORDER BY logged_at DESC, id LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}",
            *params, limit + 1, offset,
        )
    finally:
        await release_db(conn)

    items = [
        {**dict(r), "node_label": GRAPH.get(r["node_id"], {}).get("label", r["node_id"])}
        for r in rows[:limit]
    ]
    return {
        "items": items,
        "next_offset": offset + limit if len(rows) > limit else None,
        "total": total,
    }


@router.get("/summary", response_model=HistorySummaryResponse)
async def history_summary(student=Depends(get_current_student)):
    """Totals for the header of the history section."""
    conn = await get_db()
    try:
        counts = await conn.fetchrow(
            """
            SELECT
              COUNT(*) FILTER (WHERE kind = 'quiz')     AS quizzes,
              COUNT(*) FILTER (WHERE kind = 'practice') AS practices,
              MAX(score) FILTER (WHERE kind = 'quiz')   AS best_quiz,
              SUM(total_correct) FILTER (WHERE kind = 'quiz') AS correct,
              SUM(total_steps)   FILTER (WHERE kind = 'quiz') AS steps
            FROM history_logs WHERE student_id = $1
            """,
            student["id"],
        )
        pages = await conn.fetchval(
            "SELECT COUNT(*) FROM topic_checks WHERE student_id = $1 AND checked = TRUE",
            student["id"],
        )
    finally:
        await release_db(conn)

    steps = counts["steps"] or 0
    return {
        "quizzes_taken": counts["quizzes"],
        "practice_sessions": counts["practices"],
        "pages_checked": pages,
        "best_quiz_score": counts["best_quiz"],
        "quiz_accuracy": round(counts["correct"] / steps * 100, 1) if steps else None,
    }
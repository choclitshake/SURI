import uuid
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from backend.auth import get_current_student
from backend.database import get_db
from backend.models.schemas import (
    DiagnosticAnswerRequest,
    DiagnosticSubmitRequest,
    DiagnosticSkipRequest,
)
from backend.graph import GRAPH, get_prerequisite_path
from backend.competency_utils import get_chain, upsert_status, get_status
from backend.progress_utils import compute_and_save_session_progress

router = APIRouter(prefix="/api/diagnostic", tags=["diagnostic"])

# Probe definitions: At least 2 multiple choice questions per node for all 15 nodes.
PROBES = {
    "FD": [
        {
            "node_id": "FD",
            "question_text": "What is 3/4 + 1/4?",
            "options": ["1/2", "1", "4/8", "3/8"],
            "correct_option_index": 1
        },
        {
            "node_id": "FD",
            "question_text": "What is 0.5 * 0.2?",
            "options": ["0.1", "0.01", "1.0", "0.25"],
            "correct_option_index": 0
        }
    ],
    "OI": [
        {
            "node_id": "OI",
            "question_text": "What is the value of -5 + 8?",
            "options": ["-13", "3", "-3", "13"],
            "correct_option_index": 1
        },
        {
            "node_id": "OI",
            "question_text": "What is the product of -3 and -4?",
            "options": ["-12", "7", "-7", "12"],
            "correct_option_index": 3
        }
    ],
    "LE": [
        {
            "node_id": "LE",
            "question_text": "Simplify using laws of exponents: (x^3) * (x^4)",
            "options": ["x^7", "x^12", "2x^7", "x^1"],
            "correct_option_index": 0
        },
        {
            "node_id": "LE",
            "question_text": "What is the value of 5^0?",
            "options": ["0", "5", "1", "50"],
            "correct_option_index": 2
        }
    ],
    "SP": [
        {
            "node_id": "SP",
            "question_text": "Expand: (x + 3)^2",
            "options": ["x^2 + 9", "x^2 + 6x + 9", "x^2 + 3x + 9", "x^2 + 6"],
            "correct_option_index": 1
        },
        {
            "node_id": "SP",
            "question_text": "Multiply the binomials: (x + 2)(x - 2)",
            "options": ["x^2 - 4", "x^2 + 4", "x^2 - 4x - 4", "x^2 - 2"],
            "correct_option_index": 0
        }
    ],
    "FP": [
        {
            "node_id": "FP",
            "question_text": "Factor completely: x^2 - 9",
            "options": ["(x - 3)^2", "(x - 9)(x + 1)", "(x - 3)(x + 3)", "x(x - 9)"],
            "correct_option_index": 2
        },
        {
            "node_id": "FP",
            "question_text": "What is the Greatest Common Factor (GCF) of 12x^2 and 18x?",
            "options": ["6x", "6x^2", "3x", "2x"],
            "correct_option_index": 0
        }
    ],
    "RPP": [
        {
            "node_id": "RPP",
            "question_text": "If 2 cups of rice require 3 cups of water, how many cups of water are needed for 6 cups of rice?",
            "options": ["6", "9", "5", "12"],
            "correct_option_index": 1
        },
        {
            "node_id": "RPP",
            "question_text": "What is 15% of 200?",
            "options": ["15", "30", "45", "20"],
            "correct_option_index": 1
        }
    ],
    "AE": [
        {
            "node_id": "AE",
            "question_text": "Evaluate the algebraic expression 3x - 5 when x = 4.",
            "options": ["7", "12", "9", "17"],
            "correct_option_index": 0
        },
        {
            "node_id": "AE",
            "question_text": "Evaluate 2a^2 + 3b when a = 3 and b = -1.",
            "options": ["15", "21", "12", "18"],
            "correct_option_index": 0
        }
    ],
    "L1V": [
        {
            "node_id": "L1V",
            "question_text": "Solve for x: 2x + 7 = 15",
            "options": ["x = 11", "x = 4", "x = 8", "x = 2"],
            "correct_option_index": 1
        },
        {
            "node_id": "L1V",
            "question_text": "Solve for y: 3y - 4 = 2y + 5",
            "options": ["y = 9", "y = 1", "y = -9", "y = 5"],
            "correct_option_index": 0
        }
    ],
    "L2V": [
        {
            "node_id": "L2V",
            "question_text": "Find the slope of the line passing through points (1, 2) and (3, 6).",
            "options": ["2", "4", "1/2", "-2"],
            "correct_option_index": 0
        },
        {
            "node_id": "L2V",
            "question_text": "What is the y-intercept of the line y = -3x + 5?",
            "options": ["-3", "5", "5/3", "0"],
            "correct_option_index": 1
        }
    ],
    "SLE": [
        {
            "node_id": "SLE",
            "question_text": "Solve the system of equations: x + y = 6 and x - y = 2.",
            "options": ["(4, 2)", "(3, 3)", "(5, 1)", "(2, 4)"],
            "correct_option_index": 0
        },
        {
            "node_id": "SLE",
            "question_text": "Which algebraic method is best suited to solve: x = 2y - 1 and 3x + y = 11?",
            "options": ["Substitution", "Elimination", "Graphing", "Determinants"],
            "correct_option_index": 0
        }
    ],
    "RER": [
        {
            "node_id": "RER",
            "question_text": "Simplify the radical expression: sqrt(50)",
            "options": ["25 * sqrt(2)", "5 * sqrt(2)", "2 * sqrt(5)", "10 * sqrt(5)"],
            "correct_option_index": 1
        },
        {
            "node_id": "RER",
            "question_text": "Write the expression x^(2/3) in radical form.",
            "options": ["square root of x cubed", "cube root of x squared", "cube root of x", "square root of x"],
            "correct_option_index": 1
        }
    ],
    "PO": [
        {
            "node_id": "PO",
            "question_text": "Simplify: (3x^2 + 5x - 2) + (x^2 - 2x + 4)",
            "options": ["4x^2 + 3x + 2", "4x^2 + 7x + 2", "2x^2 + 3x + 6", "4x^2 - 3x - 6"],
            "correct_option_index": 0
        },
        {
            "node_id": "PO",
            "question_text": "Subtract (2x - 3) from (5x + 1).",
            "options": ["3x + 4", "3x - 2", "7x - 2", "-3x - 4"],
            "correct_option_index": 0
        }
    ],
    "PD": [
        {
            "node_id": "PD",
            "question_text": "Divide the polynomial (x^2 + 5x + 6) by (x + 2).",
            "options": ["x + 3", "x - 3", "x + 2", "x + 5"],
            "correct_option_index": 0
        },
        {
            "node_id": "PD",
            "question_text": "What is the remainder when x^3 - 2x^2 + 3x - 4 is divided by (x - 1)?",
            "options": ["-2", "2", "-1", "-4"],
            "correct_option_index": 0
        }
    ],
    "QE": [
        {
            "node_id": "QE",
            "question_text": "Find the roots of the quadratic equation: x^2 - 5x + 6 = 0.",
            "options": ["x = 2, 3", "x = -2, -3", "x = 1, 6", "x = -1, -6"],
            "correct_option_index": 0
        },
        {
            "node_id": "QE",
            "question_text": "What is the value of the discriminant for x^2 + 4x + 4 = 0?",
            "options": ["16", "8", "0", "-16"],
            "correct_option_index": 2
        }
    ],
    "PE": [
        {
            "node_id": "PE",
            "question_text": "Find the rational roots of the polynomial equation: x^3 - 6x^2 + 11x - 6 = 0.",
            "options": ["x = 1, 2, 3", "x = -1, -2, -3", "x = 0, 1, 6", "x = 1, 3, 5"],
            "correct_option_index": 0
        },
        {
            "node_id": "PE",
            "question_text": "According to the Rational Root Theorem, which of the following is a possible rational root of 2x^3 + x^2 - 3 = 0?",
            "options": ["2", "1.5", "1/2", "3/2"],
            "correct_option_index": 3
        }
    ]
}


@router.post("/skip")
async def skip_diagnostic(
    body: DiagnosticSkipRequest,
    student=Depends(get_current_student),
):
    """Skip diagnostic and start learning at the entry node."""
    session_id = body.session_id
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT topic_entry_node, student_id
            FROM sessions
            WHERE id = ? AND student_id = ?
            """,
            (session_id, student["id"]),
        )
        session_row = await cursor.fetchone()
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        topic_entry_node = session_row["topic_entry_node"]
        student_id = session_row["student_id"]
        chain = get_chain(topic_entry_node)

        if chain:
            await upsert_status(
                db, student_id, chain[0], "in_progress", "skipped"
            )
            for node_id in chain[1:]:
                await upsert_status(
                    db, student_id, node_id, "unresolved", "skipped"
                )

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """
            UPDATE sessions
            SET current_node = ?, current_probe_index = NULL,
                last_active_at = ?, completed = 0
            WHERE id = ?
            """,
            (topic_entry_node, now_iso, session_id),
        )
        await db.commit()

        return {
            "redirect_node": topic_entry_node,
            "node_label": GRAPH[topic_entry_node]["label"],
            "redirect": f"/session/{session_id}/lesson",
        }
    finally:
        await db.close()


@router.post("/{session_id}/submit")
async def submit_diagnostic(
    session_id: str,
    body: DiagnosticSubmitRequest,
    student=Depends(get_current_student),
):
    """Finalize diagnostic: write per-node competency statuses and route."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT topic_entry_node, student_id
            FROM sessions
            WHERE id = ? AND student_id = ?
            """,
            (session_id, student["id"]),
        )
        session_row = await cursor.fetchone()
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        topic_entry_node = session_row["topic_entry_node"]
        student_id = session_row["student_id"]
        chain = get_chain(topic_entry_node)

        for answer in body.answers:
            if answer.node_id not in GRAPH:
                continue
            if answer.correct:
                await upsert_status(
                    db, student_id, answer.node_id, "mastered", "diagnostic"
                )
            else:
                await upsert_status(
                    db, student_id, answer.node_id, "unresolved", "diagnostic"
                )

        gap_node = None
        for node_id in reversed(chain):
            status_record = await get_status(db, student_id, node_id)
            if status_record and status_record['status'] == 'unresolved':
                gap_node = node_id
                break

        node_statuses = []
        for node_id in chain:
            row = await get_status(db, student_id, node_id)
            node_statuses.append({
                "node_id": node_id,
                "node_label": GRAPH[node_id]["label"],
                "status": row["status"] if row else None,
                "source": row["source"] if row else None
            })

        now_iso = datetime.now(timezone.utc).isoformat()
        mastered_nodes = []
        unresolved_nodes = []
        for node_id in chain:
            row = await get_status(db, student_id, node_id)
            if row and row["status"] == "mastered":
                mastered_nodes.append(
                    {
                        "node_id": node_id,
                        "node_label": GRAPH[node_id]["label"],
                        "source": row["source"],
                    }
                )
            elif row and row["status"] == "unresolved":
                unresolved_nodes.append(
                    {
                        "node_id": node_id,
                        "node_label": GRAPH[node_id]["label"],
                    }
                )

        if gap_node is None:
            await db.execute(
                """
                UPDATE sessions
                SET completed = 1, current_node = ?,
                    current_probe_index = NULL, last_active_at = ?
                WHERE id = ?
                """,
                (topic_entry_node, now_iso, session_id),
            )
            await compute_and_save_session_progress(
                db, session_id, student_id, topic_entry_node
            )
            await db.commit()
            return {
                "all_mastered": True,
                "message": "You have already mastered all competencies in this topic.",
                "redirect": "/dashboard",
                "node_statuses": node_statuses,
            }

        await db.execute(
            """
            UPDATE sessions
            SET current_node = ?, current_probe_index = NULL,
                completed = 0, last_active_at = ?
            WHERE id = ?
            """,
            (gap_node, now_iso, session_id),
        )
        await db.commit()

        return {
            "all_mastered": False,
            "gap_node": gap_node,
            "gap_node_label": GRAPH[gap_node]["label"],
            "mastered_nodes": mastered_nodes,
            "unresolved_nodes": unresolved_nodes,
            "redirect": f"/session/{session_id}/gap-result",
            "node_statuses": node_statuses,
        }
    finally:
        await db.close()


@router.get("/{session_id}/probe")
async def get_diagnostic_probe(session_id: str, student=Depends(get_current_student)):
    """Get the next diagnostic probe question."""
    db = await get_db()
    try:
        # 1. Fetch current_node from the session
        cursor = await db.execute(
            "SELECT current_node, completed FROM sessions WHERE id = ? AND student_id = ?",
            (session_id, student["id"]),
        )
        session_row = await cursor.fetchone()
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        if session_row["completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Diagnostic session is already completed",
            )

        current_node = session_row["current_node"]
        if current_node not in PROBES:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No probes configured for node '{current_node}'",
            )

        # 2. Randomly select a probe
        probes_list = PROBES[current_node]
        probe_idx = random.randint(0, len(probes_list) - 1)
        selected_probe = probes_list[probe_idx]

        # 3. Save selected probe index in session
        await db.execute(
            "UPDATE sessions SET current_probe_index = ?, last_active_at = ? WHERE id = ?",
            (probe_idx, datetime.now(timezone.utc).isoformat(), session_id),
        )
        await db.commit()

        # 4. Return probe without correct answer
        return {
            "node_id": current_node,
            "question_text": selected_probe["question_text"],
            "options": selected_probe["options"],
        }
    finally:
        await db.close()


@router.post("/{session_id}/answer")
async def submit_diagnostic_answer(
    session_id: str,
    body: DiagnosticAnswerRequest,
    student=Depends(get_current_student),
):
    """Submit an answer to a diagnostic probe."""
    db = await get_db()
    try:
        # 1. Retrieve session and currently served probe details
        cursor = await db.execute(
            "SELECT current_node, current_probe_index, topic_entry_node, completed FROM sessions WHERE id = ? AND student_id = ?",
            (session_id, student["id"]),
        )
        session_row = await cursor.fetchone()
        if not session_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        if session_row["completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Diagnostic session is already completed",
            )

        current_node = session_row["current_node"]
        probe_idx = session_row["current_probe_index"]

        if probe_idx is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active probe found for this session. Fetch a probe first.",
            )

        # Check node_id consistency
        if body.node_id != current_node:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Submitted node_id '{body.node_id}' does not match current session node '{current_node}'",
            )

        # 2. Check if answer is correct
        probes_list = PROBES[current_node]
        probe = probes_list[probe_idx]
        is_correct = body.selected_option_index == probe["correct_option_index"]

        # 3. Log results to diagnostic_logs
        log_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """
            INSERT INTO diagnostic_logs (id, session_id, node_id, probe_result, logged_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (log_id, session_id, current_node, 1 if is_correct else 0, now_iso),
        )

        # 4. Traversal logic: Check prerequisite
        prereq = GRAPH[current_node]["prerequisite"]

        if prereq:
            # Move downward (closer to root/prerequisites)
            await db.execute(
                "UPDATE sessions SET current_node = ?, current_probe_index = NULL, last_active_at = ? WHERE id = ?",
                (prereq, now_iso, session_id),
            )
            await db.commit()

            return {
                "correct": is_correct,
                "next_action": "next_probe",
                "next_node_id": prereq,
                "identified_node_id": None,
                "prerequisite_path": None,
            }
        else:
            identified_weak_node = current_node
            prereq_path = get_prerequisite_path(
                identified_weak_node, session_row["topic_entry_node"]
            )
            await db.execute(
                """
                UPDATE sessions SET last_active_at = ?, current_probe_index = NULL
                WHERE id = ?
                """,
                (now_iso, session_id),
            )
            await db.commit()

            return {
                "correct": is_correct,
                "next_action": "complete",
                "next_node_id": None,
                "identified_node_id": identified_weak_node,
                "prerequisite_path": prereq_path,
            }
    finally:
        await db.close()

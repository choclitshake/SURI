"""
Practice routes for SURI.

Implements the GO3 practice pipeline including mathsteps integration,
scaffold problem generation with word problems, step-level answer evaluation,
and misconception logging with AI tutor feedback.
"""

import subprocess
import json
import uuid
import os
import re
import asyncio
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from backend.auth import get_current_student
from backend.database import get_db
from backend.graph import GRAPH
from backend.models.schemas import (
    PracticeStartRequest,
    PracticeStartResponse,
    PracticeSubmitStepRequest,
    PracticeSubmitStepResponse,
    PracticeProblemResponse,
    PracticeStep,
    StepEvaluationResult
)
import google.generativeai as genai

router = APIRouter(prefix="/api/practice", tags=["practice"])

NODE_EXPRESSIONS = {
    "FD":  ["1/2 + 1/4", "3/4 - 1/8", "2/3 * 3/4", "5/6 - 1/3", "1/4 + 3/8"],
    "OI":  ["-3 + 7", "-5 - (-2)", "4 * -3", "-12 / 4", "6 + (-9)"],
    "LE":  ["x^2 * x^3", "x^5 / x^2", "(x^2)^3", "x^0", "x^3 * x^(-1)"],
    "SP":  ["(x+2)*(x+3)", "(x+1)*(x-1)", "(x+3)^2", "(2x+1)*(x+4)", "(x-2)^2"],
    "FP":  ["x^2 + 5*x + 6", "x^2 - 4", "2*x^2 + 4*x", "x^2 - 9", "x^2 + 7*x + 12"],
    "RPP": ["3/4 = x/8", "2/5 = 4/x", "x/3 = 6/9", "5/x = 10/14", "1/2 = x/10"],
    "AE":  ["2*x + 3", "x^2 - x + 1", "3*x - 2*x + 5", "4*(x+2)", "x + 2*x + 3*x"],
    "L1V": ["2*x + 3 = 7", "x - 4 = 10", "3*x = 15", "x/2 = 6", "5*x - 2 = 13"],
    "L2V": ["y = 2*x + 1", "2*x + y = 10", "y - x = 3", "3*x - y = 6", "x + 2*y = 8"],
    "SLE": ["2*x + y = 10, x - y = 2", "x + y = 5, x - y = 1", "3*x + 2*y = 12, x + y = 5"],
    "RER": ["sqrt(16)", "sqrt(x^2)", "x^(1/2) * x^(1/2)", "27^(1/3)", "sqrt(9*x^2)"],
    "PO":  ["(x^2 + 2*x) + (x^2 - x)", "(3*x^2 + x) - (x^2 + 2*x)", "2*(x^2 + 3*x)", "(x^2)(x+1)", "x*(x^2 - x + 1)"],
    "PD":  ["(x^2 + 3*x + 2) / (x + 1)", "(x^2 - 4) / (x - 2)", "(x^3 - x^2) / x"],
    "QE":  ["x^2 + 5*x + 6 = 0", "x^2 - 4 = 0", "x^2 - 3*x + 2 = 0", "2*x^2 + 4*x = 0", "x^2 - x - 6 = 0"],
    "PE":  ["x^3 - x = 0", "x^3 - 4*x = 0", "x^2*(x-1) = 0"]
}

GRAPH_NODE_LIST = "\n".join([f"{nid}: {node['label']}" for nid, node in GRAPH.items()])


async def generate_scaffold_for_expression(node_id: str, expression: str) -> dict:
    """Call mathsteps runner to simplify, then invoke Gemini to generate a full scaffold problem."""
    # Step 1: call mathsteps runner as an async subprocess
    try:
        proc = await asyncio.create_subprocess_exec(
            'node', 'mathsteps_runner/runner.js', expression,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
        
        raw_output = stdout.decode().strip()
        if not raw_output:
            mathsteps_output = []
        else:
            raw = json.loads(raw_output)
            if isinstance(raw, dict) and 'error' in raw:
                raise ValueError(raw['error'])
            mathsteps_output = raw
    except Exception as e:
        print(f"mathsteps runner failed or timed out: {e}")
        mathsteps_output = []

    # Step 2: call Gemini to convert to scaffold steps
    prompt = f"""
You are generating a step-by-step fill-in-the-blanks scaffold problem for a Philippine JHS algebra student.
The student is practicing: {GRAPH[node_id]['label']} (node_id: {node_id}, Grade {GRAPH[node_id]['grade']})

The following node_ids exist in the system. You must only use these when assigning mapped_node_id:
{GRAPH_NODE_LIST}

ORIGINAL EXPRESSION: {expression}

RAW MATHSTEPS SOLUTION (may be empty if mathsteps could not solve it):
{json.dumps(mathsteps_output)}

TASK:
1. Write a short 2 to 3 sentence word problem appropriate for a Grade {GRAPH[node_id]['grade']} student whose solution requires solving or evaluating the given algebra expression: {expression}.
2. Generate a variable identification phase as the first 1 to 2 steps of the scaffold where the student identifies what each variable represents and writes out the equation derived from the problem (set step_type to "variable_identification").
3. Produce the remaining algebra steps from the mathsteps output (or standard algebra procedure if mathsteps output is empty). These steps must have step_type set to "algebra".
For EACH step in the scaffold, produce a JSON object with these exact fields:
- step_index: integer starting at 0 (variable identification steps come first, then algebra steps, sequential indexing)
- step_type: "variable_identification" or "algebra"
- instruction: short imperative string (e.g. "Identify what the variable x represents" or "Factor out the GCF from both terms")
- blank_expression: the expression at this step with the key computed value replaced by ___ (e.g., "x = ___" or "2*x + ___ = 7")
- correct_value: the exact string the student must type to fill the blank (keep it simple and direct)
- mapped_node_id: the single node_id from the list above that this step most directly tests. Use the most specific node that applies. If the step tests the current competency directly, use {node_id}. You must only use node_ids from the provided list.
- operation_description: brief label for the operation (e.g. "Variable identification" or "Applying the distributive property")

Return a JSON object containing:
- word_problem_text: the 2 to 3 sentence word problem text.
- steps: a JSON array of the step objects.

No other text, no markdown, no code fences. Return raw JSON string only.
"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is missing")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3.1-flash-lite')
    
    try:
        response = await asyncio.wait_for(
            model.generate_content_async(prompt),
            timeout=25.0
        )
        text = response.text.strip()
    except Exception as e:
        print(f"Gemini API failed: {e}")
        # Return fallback scaffold
        text = json.dumps({
            "word_problem_text": f"Solve the following algebra problem: {expression}",
            "steps": [
                {
                    "step_index": 0,
                    "step_type": "variable_identification",
                    "instruction": "Identify the starting expression to solve.",
                    "blank_expression": "Expression = ___",
                    "correct_value": expression,
                    "mapped_node_id": node_id,
                    "operation_description": "Variable identification"
                }
            ]
        })

    # Clean text if Gemini wraps it in markdown code block
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n", "", text)
        text = re.sub(r"\n```$", "", text)
        text = text.strip()

    try:
        data = json.loads(text)
        word_problem_text = data.get("word_problem_text", f"Solve the following expression: {expression}")
        steps = data.get("steps", [])
    except Exception as parse_err:
        print(f"Error parsing Gemini response JSON: {parse_err}. Response was: {text}")
        word_problem_text = f"Solve the following expression: {expression}"
        steps = [
            {
                "step_index": 0,
                "step_type": "algebra",
                "instruction": f"Solve the expression {expression}",
                "blank_expression": "___",
                "correct_value": expression,
                "mapped_node_id": node_id,
                "operation_description": "Algebra simplification"
            }
        ]

    # Validate all mapped_node_ids
    valid_ids = set(GRAPH.keys())
    for step in steps:
        if step.get('mapped_node_id') not in valid_ids:
            step['mapped_node_id'] = node_id

    return {
        "id": str(uuid.uuid4()),
        "node_id": node_id,
        "problem_expr": expression,
        "word_problem_text": word_problem_text,
        "steps_json": json.dumps(steps),
        "created_at": datetime.now(timezone.utc).isoformat()
    }


def normalize_val(val: str) -> str:
    """Normalize input strings for robust mathematical comparison."""
    val = val.strip().lower()
    # Remove spaces around operators: +, -, *, /, =, (, ), ^, ,
    val = re.sub(r'\s*([\+\-\*/=\(\)\^,])\s*', r'\1', val)
    # Collapse multiple whitespace to single space
    val = re.sub(r'\s+', ' ', val)
    return val


def is_float(val: str) -> bool:
    """Check if value is purely numeric and convertible to float."""
    try:
        float(val)
        return True
    except ValueError:
        return False


@router.post("/start", response_model=PracticeStartResponse)
async def start_practice(body: PracticeStartRequest, student=Depends(get_current_student)):
    """Initialize or retrieve a set of 5 practice problems for a competency node."""
    session_id = body.session_id
    node_id = body.node_id
    
    if node_id not in GRAPH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid node_id: '{node_id}'"
        )
    
    db = await get_db()
    try:
        # 1. Fetch existing practice_problems for this node_id
        cursor = await db.execute(
            "SELECT id, node_id, problem_expr, steps_json, word_problem_text FROM practice_problems WHERE node_id = ?",
            (node_id,),
        )
        existing_rows = await cursor.fetchall()
        problems_list = []
        for r in existing_rows:
            problems_list.append({
                "id": r["id"],
                "node_id": r["node_id"],
                "problem_expr": r["problem_expr"],
                "word_problem_text": r["word_problem_text"],
                "steps": json.loads(r["steps_json"])
            })

        # 2. Require at least 10 pre-seeded problems; sample 5 when available
        if len(problems_list) < 10:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "no_practice_content", "node_id": node_id},
            )

        sampled = random.sample(problems_list, 5)
        
        # Update sessions.last_active_at
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE sessions SET last_active_at = ? WHERE id = ?",
            (now_iso, session_id),
        )
        await db.commit()

        return {"problems": sampled}
    finally:
        await db.close()


@router.post("/submit-step", response_model=PracticeSubmitStepResponse)
async def submit_step(body: PracticeSubmitStepRequest, student=Depends(get_current_student)):
    """Evaluate all submitted steps for a single practice problem, checking for misconceptions."""
    session_id = body.session_id
    node_id = body.node_id
    problem_id = body.problem_id
    student_steps = body.student_steps

    db = await get_db()
    try:
        # 1. Load problem from practice_problems
        cursor = await db.execute(
            "SELECT steps_json, problem_expr FROM practice_problems WHERE id = ?",
            (problem_id,),
        )
        problem_row = await cursor.fetchone()
        if not problem_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

        parsed_steps = json.loads(problem_row["steps_json"])
        student_submission_dict = {s.step_index: s.submitted_value for s in student_steps}

        # 2. Evaluate each step
        step_results = []
        misconception_found = False
        misconception_step_index = None
        misconception_node_id = None
        misconception_node_label = None
        feedback_text = None

        for step in parsed_steps:
            step_index = step["step_index"]
            correct_value = step["correct_value"]
            submitted_value = student_submission_dict.get(step_index, "")

            # Normalization
            sub_norm = normalize_val(submitted_value)
            corr_norm = normalize_val(correct_value)

            # Floats with 0.01 tolerance comparison
            if is_float(sub_norm) and is_float(corr_norm):
                correct = abs(float(sub_norm) - float(corr_norm)) <= 0.01
            else:
                correct = sub_norm == corr_norm

            step_results.append({
                "step_index": step_index,
                "correct": correct,
                "submitted_value": submitted_value,
                "correct_value": correct_value
            })

            # Check if this is the first wrong step to log as misconception
            if not correct and not misconception_found:
                misconception_found = True
                misconception_step_index = step_index
                misconception_node_id = step.get("mapped_node_id", node_id)

        # 3. Log misconception and generate tutor feedback if found
        temp_attempt_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        # Calculate score and pass status
        total_steps = len(parsed_steps)
        correct_count = sum(1 for r in step_results if r["correct"])
        score = int((correct_count / total_steps) * 100) if total_steps > 0 else 0
        passed = 1 if correct_count == total_steps else 0

        # Create record in practice_attempts to satisfy the foreign keys
        await db.execute(
            """
            INSERT INTO practice_attempts (
                id, session_id, node_id, problem_id, student_steps_json, score, passed, attempted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                temp_attempt_id,
                session_id,
                node_id,
                problem_id,
                json.dumps([{"step_index": s.step_index, "submitted_value": s.submitted_value} for s in student_steps]),
                score,
                passed,
                now_iso,
            )
        )

        if misconception_found:
            mapped_node_label = GRAPH.get(misconception_node_id, {}).get("label", "Concept")
            misconception_node_label = mapped_node_label

            step_obj = parsed_steps[misconception_step_index]
            submitted_val_wrong = student_submission_dict.get(misconception_step_index, "")
            correct_val_wrong = step_obj["correct_value"]

            # Store in misconception_logs
            misconception_log_id = str(uuid.uuid4())
            await db.execute(
                """
                INSERT INTO misconception_logs (
                    id, session_id, practice_attempt_id, problem_id, step_index, step_description, mapped_node_id, logged_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    misconception_log_id,
                    session_id,
                    temp_attempt_id,
                    problem_id,
                    misconception_step_index,
                    step_obj.get("operation_description", "Operation"),
                    misconception_node_id,
                    now_iso,
                )
            )

            # Generate feedback via Gemini
            node_label = GRAPH.get(node_id, {}).get("label", "Topic")
            prompt = f"""You are a math tutor. The student is practicing {node_label}.
They got Step {misconception_step_index+1} wrong: '{step_obj.get("instruction")}'.
They wrote: '{submitted_val_wrong}'. Correct answer: '{correct_val_wrong}'.
This step tests: {mapped_node_label}.
Write 2-3 sentences of plain, encouraging feedback explaining the error and what concept to review. Name the concept {mapped_node_label} explicitly.
No math formatting."""
            
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                try:
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-3.1-flash-lite')
                    response = await asyncio.wait_for(
                        model.generate_content_async(prompt),
                        timeout=15.0
                    )
                    feedback_text = response.text.strip()
                except Exception as ex:
                    print(f"Gemini feedback generation failed: {ex}")
                    feedback_text = f"Keep practicing! It seems you had some trouble with {mapped_node_label}. Review this topic to strengthen your understanding."
            else:
                feedback_text = f"Keep practicing! It seems you had some trouble with {mapped_node_label}. Review this topic to strengthen your understanding."

        # Update sessions.last_active_at
        await db.execute(
            "UPDATE sessions SET last_active_at = ? WHERE id = ?",
            (now_iso, session_id),
        )
        await db.commit()

        return {
            "step_results": step_results,
            "misconception_found": misconception_found,
            "misconception_step_index": misconception_step_index,
            "misconception_node_id": misconception_node_id,
            "misconception_node_label": misconception_node_label,
            "feedback_text": feedback_text
        }
    finally:
        await db.close()

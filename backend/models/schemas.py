"""
Pydantic request/response models for SURI API.
"""

from pydantic import BaseModel
from typing import Optional


# ─── Auth ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    grade_level: int
    password: str


class LoginRequest(BaseModel):
    name: str
    password: str


class AuthResponse(BaseModel):
    student_id: str
    token: str


# ─── Sessions ─────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    topic_entry_node: str


class SessionResponse(BaseModel):
    id: str
    student_id: str
    topic_entry_node: str
    current_node: str
    started_at: str
    last_active_at: str
    completed: int
    completion_percentage: float


class UpdateSessionRequest(BaseModel):
    current_node: Optional[str] = None
    completed: Optional[int] = None


class UpdateProgressRequest(BaseModel):
    completion_percentage: float


# ─── Diagnostic ───────────────────────────────────────

class DiagnosticProbeResponse(BaseModel):
    node_id: str
    question_text: str
    options: list[str]


class DiagnosticAnswerRequest(BaseModel):
    node_id: str
    selected_option_index: int


class DiagnosticAnswerResponse(BaseModel):
    correct: bool
    next_action: str  # 'next_probe' | 'complete'
    next_node_id: Optional[str] = None
    identified_node_id: Optional[str] = None
    prerequisite_path: Optional[list[str]] = None


# ─── Content ──────────────────────────────────────────

class GenerateContentRequest(BaseModel):
    session_id: str
    node_id: str


class ContentResponse(BaseModel):
    node_id: str
    lesson_text: str
    worked_example: str
    guided_explanation: str


# ─── Practice ─────────────────────────────────────────

class PracticeStartRequest(BaseModel):
    session_id: str
    node_id: str


class PracticeStep(BaseModel):
    step_index: int
    step_type: str  # "variable_identification" or "algebra"
    instruction: str
    blank_expression: str
    correct_value: str
    mapped_node_id: str
    operation_description: str


class PracticeProblemResponse(BaseModel):
    id: str
    node_id: str
    problem_expr: str
    word_problem_text: Optional[str] = None
    steps: list[PracticeStep]


class PracticeStartResponse(BaseModel):
    problems: list[PracticeProblemResponse]


class StudentStepSubmission(BaseModel):
    step_index: int
    submitted_value: str


class PracticeSubmitStepRequest(BaseModel):
    session_id: str
    node_id: str
    problem_id: str
    student_steps: list[StudentStepSubmission]


class StepEvaluationResult(BaseModel):
    step_index: int
    correct: bool
    submitted_value: str
    correct_value: str


class PracticeSubmitStepResponse(BaseModel):
    step_results: list[StepEvaluationResult]
    misconception_found: bool
    misconception_step_index: Optional[int] = None
    misconception_node_id: Optional[str] = None
    misconception_node_label: Optional[str] = None
    feedback_text: Optional[str] = None


# ─── Progression ──────────────────────────────────────

class ProgressionDecideRequest(BaseModel):
    session_id: str
    node_id: str


class ProgressionDecideResponse(BaseModel):
    decision: str  # 'advance' or 'remediate'
    next_node_id: Optional[str] = None
    mastery_score: float


# ─── Student ──────────────────────────────────────────

class TopicInfo(BaseModel):
    node_id: str
    label: str
    grade: int


class TopicIntroResponse(BaseModel):
    node_id: str
    label: str
    description: str
    prerequisite_chain: list[str]


class StudentProgressResponse(BaseModel):
    student_id: str
    competencies: list[dict]
    sessions: list[dict]

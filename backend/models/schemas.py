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


class PracticeStartResponse(BaseModel):
    problem_id: str
    problem_expr: str
    total_steps: int


class PracticeSubmitStepRequest(BaseModel):
    session_id: str
    problem_id: str
    step_index: int
    student_step: str


class PracticeSubmitStepResponse(BaseModel):
    correct: bool
    expected_step: str
    hint: Optional[str] = None
    attempt_complete: bool
    score: Optional[int] = None
    passed: Optional[bool] = None


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

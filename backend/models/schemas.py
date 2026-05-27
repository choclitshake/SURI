"""
Pydantic request/response models for SURI API.
"""

from pydantic import BaseModel
from typing import Optional


# ─── Auth ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    grade_level: int
    password: str


class LoginRequest(BaseModel):
    email: str
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
    completion_percentage: Optional[float] = None


# ─── Diagnostic ───────────────────────────────────────

class DiagnosticProbeResponse(BaseModel):
    node_id: str
    question_text: str
    options: list[str]


class DiagnosticAnswerRequest(BaseModel):
    node_id: str
    selected_option_index: int


class DiagnosticAnswerItem(BaseModel):
    node_id: str
    correct: bool


class DiagnosticSubmitRequest(BaseModel):
    answers: list[DiagnosticAnswerItem]


class DiagnosticSkipRequest(BaseModel):
    session_id: str


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


class MisconceptionNode(BaseModel):
    node_id: str
    node_label: str


class GoDeeperNode(BaseModel):
    node_id: str
    node_label: str


class ProgressionDecideResponse(BaseModel):
    decision: str  # 'advance' or 'remediate'
    mastery_score: float
    passed_count: int
    next_node_id: Optional[str] = None
    next_node_label: Optional[str] = None
    topic_complete: Optional[bool] = None
    misconception_nodes: Optional[list[MisconceptionNode]] = None
    go_deeper_available: Optional[bool] = None
    go_deeper_node: Optional[GoDeeperNode] = None


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


# ─── Quiz Mode ────────────────────────────────────────

class QuizStartRequest(BaseModel):
    session_id: str
    node_id: str


class QuizStepWithChoices(BaseModel):
    step_index: int
    step_type: str
    instruction: str
    blank_expression: str
    operation_description: str
    mapped_node_id: str
    choices: list[str]   # 4 items: correct + 3 distractors, shuffled
    timer_ms: int        # 20000 for variable_identification, 30000 for algebra


class QuizProblem(BaseModel):
    id: str
    node_id: str
    problem_expr: str
    word_problem_text: Optional[str] = None
    steps: list[QuizStepWithChoices]


class QuizStartResponse(BaseModel):
    quiz_session_id: str
    problems: list[QuizProblem]


class QuizSubmitStepRequest(BaseModel):
    quiz_session_id: str
    problem_id: str
    step_index: int
    submitted_value: Optional[str] = None  # None = timeout
    time_remaining_ms: int


class QuizSubmitStepResponse(BaseModel):
    correct: bool
    correct_value: str
    points_earned: int
    total_points: int
    current_streak: int       
    streak_multiplier: float


class QuizSkipStepRequest(BaseModel):
    quiz_session_id: str
    problem_id: str
    step_index: int


class QuizSkipStepResponse(BaseModel):
    correct_value: str


class QuizUseHintRequest(BaseModel):
    quiz_session_id: str
    problem_id: str
    step_index: int
    hint_type: str = "hint"   # "hint" | "equation"


class QuizUseHintResponse(BaseModel):
    hint_text: str
    points_deducted: int
    total_points: int


class QuizStepError(BaseModel):
    problem_id: str
    step_index: int
    step_type: str
    operation_description: str
    submitted_value: str
    correct_value: str


class QuizProgressionResult(BaseModel):
    decision: str
    mastery_score: float
    passed_count: int
    topic_complete: Optional[bool] = None
    next_node_id: Optional[str] = None
    next_node_label: Optional[str] = None
    go_deeper_available: Optional[bool] = None
    go_deeper_node: Optional[dict] = None
    misconception_nodes: Optional[list] = None


class QuizFinishRequest(BaseModel):
    quiz_session_id: str


class QuizFinishResponse(BaseModel):
    total_points: int
    total_correct: int
    total_steps: int
    passed_count: int
    step_errors: list[QuizStepError]
    feedback_text: str
    progression: QuizProgressionResult

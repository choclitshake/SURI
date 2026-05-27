/**
 * Typed fetch wrappers for all SURI API endpoints.
 *
 * Every function: sets correct method/Content-Type, includes credentials
 * for cookie-based auth, returns typed data or throws a typed error.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Error type ──────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail: any;

  constructor(status: number, detail: any) {
    super(typeof detail === "string" ? detail : "API Error");
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// ─── Helpers ─────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────

export interface AuthResponse {
  student_id: string;
  token: string;
}

export interface TopicInfo {
  node_id: string;
  label: string;
  grade: number;
}

export interface TopicIntro {
  node_id: string;
  label: string;
  grade: number;
  description: string;
  prerequisite_chain: string[];
}

export interface SessionResponse {
  id: string;
  student_id: string;
  topic_entry_node: string;
  current_node: string;
  started_at: string;
  last_active_at: string;
  completed: number;
  completion_percentage: number;
}

export interface DiagnosticProbe {
  node_id: string;
  question_text: string;
  options: string[];
}

export interface DiagnosticAnswer {
  correct: boolean;
  next_action: "next_probe" | "complete";
  next_node_id: string | null;
  identified_node_id: string | null;
  prerequisite_path: string[] | null;
}

export interface CompetencyStatus {
  status: string;
  source: string;
}

export interface ContentResponse {
  node_id: string;
  node_label: string;
  lesson: string;
  worked_example: string;
  guided_explanation: string;
  source_doc: string;
  simplified_lesson_text?: string | null;
  competency_status?: CompetencyStatus | null;
  error?: string;
}

export interface SimplifiedContentResponse {
  lesson?: string;
  worked_example?: string;
  guided_explanation?: string;
  simplified_lesson_text?: string;
  [key: string]: unknown;
}

export interface PracticeStep {
  step_index: number;
  step_type: "variable_identification" | "algebra";
  instruction: string;
  blank_expression: string;
  correct_value: string;
  mapped_node_id: string;
  operation_description: string;
}

export interface PracticeProblem {
  id: string;
  node_id: string;
  problem_expr: string;
  word_problem_text: string | null;
  steps: PracticeStep[];
}

export interface PracticeStartResponse {
  problems: PracticeProblem[];
}

export interface StepEvaluationResult {
  step_index: number;
  correct: boolean;
  submitted_value: string;
  correct_value: string;
}

export interface PracticeSubmitStepResponse {
  step_results: StepEvaluationResult[];
  misconception_found: boolean;
  misconception_step_index: number | null;
  misconception_node_id: string | null;
  misconception_node_label: string | null;
  feedback_text: string | null;
}

export interface MisconceptionNode {
  node_id: string;
  node_label: string;
}

export interface GoDeeperNode {
  node_id: string;
  node_label: string;
}

export interface ProgressionDecision {
  decision: "advance" | "remediate";
  mastery_score: number;
  passed_count: number;
  next_node_id?: string | null;
  next_node_label?: string | null;
  topic_complete?: boolean;
  misconception_nodes?: MisconceptionNode[];
  go_deeper_available?: boolean;
  go_deeper_node?: GoDeeperNode | null;
}

export interface MeResponse {
  student_id: string;
  name: string;
  email: string | null;
}

export interface CompetencyNodeSummary {
  node_id: string;
  node_label: string;
  source?: string;
}

export interface ActiveSessionProgress {
  id: string;
  student_id: string;
  topic_entry_node: string;
  current_node: string;
  topic_label: string;
  current_node_label: string;
  completion_percentage: number;
  total_in_chain: number;
  mastered_count: number;
  diagnostic_count: number;
  practice_count: number;
  mastered_nodes: CompetencyNodeSummary[];
  in_progress_nodes: CompetencyNodeSummary[];
  unresolved_nodes: CompetencyNodeSummary[];
  started_at: string;
  last_active_at: string;
  completed_at?: string;
}

export interface MisconceptionHistoryItem {
  node_id: string;
  node_label: string;
  step_description: string;
  logged_at: string;
}

export interface StudentProgress {
  active_sessions: ActiveSessionProgress[];
  completed_sessions: ActiveSessionProgress[];
  misconception_history: MisconceptionHistoryItem[];
}

export interface DiagnosticSubmitAnswer {
  node_id: string;
  correct: boolean;
}

export interface DiagnosticSubmitResponse {
  all_mastered: boolean;
  message?: string;
  redirect: string;
  gap_node?: string;
  gap_node_label?: string;
  mastered_nodes?: CompetencyNodeSummary[];
  unresolved_nodes?: CompetencyNodeSummary[];
}

export interface DiagnosticSkipResponse {
  redirect_node: string;
  node_label: string;
  redirect: string;
}

export interface SaveProgressResponse {
  success: boolean;
  completion_percentage: number;
  mastered_in_chain: number;
  total_in_chain: number;
}

// ─── Auth ────────────────────────────────────────────

export function register(body: {
  name: string;
  email: string;
  grade_level: number;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function login(body: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>("/api/auth/me");
}

export function logout(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

// ─── Topics ──────────────────────────────────────────

export function getTopics(): Promise<TopicInfo[]> {
  return request<TopicInfo[]>("/api/topics");
}

export function getTopicIntro(nodeId: string): Promise<TopicIntro> {
  return request<TopicIntro>(`/api/topics/${nodeId}/intro`);
}

export function getTopicChain(
  nodeId: string
): Promise<{ chain: string[] }> {
  return request<{ chain: string[] }>(`/api/topics/${nodeId}/chain`);
}

export function getGraphChain(
  topicEntryNode: string
): Promise<{ topic_entry_node: string; chain: { node_id: string; node_label: string; grade: number }[] }> {
  return request<{ topic_entry_node: string; chain: { node_id: string; node_label: string; grade: number }[] }>(`/api/graph/${topicEntryNode}/chain`);
}

// ─── Sessions ────────────────────────────────────────

export function createSession(body: {
  topic_entry_node: string;
}): Promise<SessionResponse> {
  return request<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/sessions/${sessionId}`);
}

export function updateSession(
  sessionId: string,
  body: { current_node?: string; completed?: number }
): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function saveProgress(
  sessionId: string
): Promise<SaveProgressResponse> {
  return request<SaveProgressResponse>(
    `/api/sessions/${sessionId}/progress`,
    { method: "PATCH" }
  );
}

// ─── Diagnostic ──────────────────────────────────────

export function getDiagnosticProbe(
  sessionId: string
): Promise<DiagnosticProbe> {
  return request<DiagnosticProbe>(`/api/diagnostic/${sessionId}/probe`);
}

export function submitDiagnosticAnswer(
  sessionId: string,
  body: { node_id: string; selected_option_index: number }
): Promise<DiagnosticAnswer> {
  return request<DiagnosticAnswer>(`/api/diagnostic/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitDiagnostic(
  sessionId: string,
  body: { answers: DiagnosticSubmitAnswer[] }
): Promise<DiagnosticSubmitResponse> {
  return request<DiagnosticSubmitResponse>(
    `/api/diagnostic/${sessionId}/submit`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function skipDiagnostic(
  sessionId: string
): Promise<DiagnosticSkipResponse> {
  return request<DiagnosticSkipResponse>("/api/diagnostic/skip", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// ─── Content ─────────────────────────────────────────

export async function getContent(nodeId: string): Promise<ContentResponse> {
  const url = `${API_BASE}/api/content/${nodeId}`;
  const res = await fetch(url, { credentials: "include" });
  const body = await res.json();
  if (!res.ok) {
    if (body?.error === "no_content") {
      return {
        node_id: body.node_id ?? nodeId,
        node_label: "",
        lesson: "",
        worked_example: "",
        guided_explanation: "",
        source_doc: "",
        error: "no_content",
      };
    }
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  return body as ContentResponse;
}

export function simplifyContent(
  nodeId: string
): Promise<SimplifiedContentResponse> {
  return request<SimplifiedContentResponse>(`/api/content/${nodeId}/simplify`, {
    method: "POST",
  });
}

// ─── Practice ────────────────────────────────────────

export async function startPractice(body: {
  session_id: string;
  node_id: string;
}): Promise<PracticeStartResponse> {
  const url = `${API_BASE}/api/practice/start`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail ?? data;
    const message =
      typeof detail === "object" && detail?.error === "no_practice_content"
        ? "Practice problems are not available for this topic yet."
        : typeof detail === "string"
          ? detail
          : JSON.stringify(detail);
    throw new ApiError(res.status, message);
  }
  return data as PracticeStartResponse;
}

export function submitPracticeStep(body: {
  session_id: string;
  node_id: string;
  problem_id: string;
  student_steps: { step_index: number; submitted_value: string }[];
}): Promise<PracticeSubmitStepResponse> {
  return request<PracticeSubmitStepResponse>("/api/practice/submit-step", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Progression ─────────────────────────────────────

export function decideProgression(body: {
  session_id: string;
  node_id: string;
}): Promise<ProgressionDecision> {
  return request<ProgressionDecision>("/api/progression/decide", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Student ─────────────────────────────────────────

export function getStudentProgress(
  studentId: string
): Promise<StudentProgress> {
  return request<StudentProgress>(`/api/students/${studentId}/progress`);
}

// ─── Quiz Mode ─────────────────────────────────────────

export interface QuizStepWithChoices {
  step_index: number;
  step_type: string;
  instruction: string;
  blank_expression: string;
  operation_description: string;
  mapped_node_id: string;
  choices: string[];
  correct_value: string;
  timer_ms: number;
}

export interface QuizProblem {
  id: string;
  node_id: string;
  problem_expr: string;
  word_problem_text: string | null;
  steps: QuizStepWithChoices[];
}

export interface QuizStartResponse {
  quiz_session_id: string;
  problems: QuizProblem[];
}

export interface QuizSubmitStepResponse {
  correct: boolean;
  correct_value: string;
  points_earned: number;
  total_points: number;
  current_streak: number;   
  streak_multiplier: number; 
}

export interface QuizSkipStepResponse {
  correct_value: string;
}

export interface QuizUseHintResponse {
  hint_text: string;
  points_deducted: number;
  total_points: number;
}

export interface QuizStepError {
  problem_id: string;
  step_index: number;
  step_type: string;
  operation_description: string;
  submitted_value: string;
  correct_value: string;
}

export interface QuizFinishResponse {
  total_points: number;
  total_correct: number;
  total_steps: number;
  passed_count: number;
  step_errors: QuizStepError[];
  feedback_text: string;
  progression: ProgressionDecision;
}

export function startQuiz(body: {
  session_id: string;
  node_id: string;
}): Promise<QuizStartResponse> {
  return request<QuizStartResponse>("/api/quiz/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitQuizStep(body: {
  quiz_session_id: string;
  problem_id: string;
  step_index: number;
  submitted_value: string | null;
  time_remaining_ms: number;
  save_streak?: boolean;
}): Promise<QuizSubmitStepResponse> {
  return request<QuizSubmitStepResponse>("/api/quiz/submit-step", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function skipQuizStep(body: {
  quiz_session_id: string;
  problem_id: string;
  step_index: number;
}): Promise<QuizSkipStepResponse> {
  return request<QuizSkipStepResponse>("/api/quiz/skip-step", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function useQuizHint(body: {
  quiz_session_id: string;
  problem_id: string;
  step_index: number;
  hint_type: string;
  saved_streak?: number;
}): Promise<QuizUseHintResponse> {
  return request<QuizUseHintResponse>("/api/quiz/use-hint", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function finishQuiz(body: {
  quiz_session_id: string;
}): Promise<QuizFinishResponse> {
  return request<QuizFinishResponse>("/api/quiz/finish", {
    method: "POST",
    body: JSON.stringify(body),
  });
}


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
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
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
  question: string;
  choices: string[];
}

export interface DiagnosticAnswer {
  correct: boolean;
  node_id: string;
  next_node_id: string | null;
}

export interface ContentResponse {
  node_id: string;
  lesson_text: string;
  worked_example: string;
  guided_explanation: string;
}

export interface PracticeStartResponse {
  problem_id: string;
  problem_expr: string;
  total_steps: number;
}

export interface PracticeStepResponse {
  correct: boolean;
  expected_step: string;
  hint: string | null;
  attempt_complete: boolean;
  score: number | null;
  passed: boolean | null;
}

export interface ProgressionDecision {
  decision: "advance" | "remediate";
  next_node_id: string | null;
  mastery_score: number;
}

export interface StudentProgress {
  student_id: string;
  competencies: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
}

// ─── Auth ────────────────────────────────────────────

export function register(body: {
  name: string;
  grade_level: number;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function login(body: {
  name: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Topics ──────────────────────────────────────────

export function getTopics(): Promise<TopicInfo[]> {
  return request<TopicInfo[]>("/api/topics");
}

export function getTopicIntro(nodeId: string): Promise<TopicIntro> {
  return request<TopicIntro>(`/api/topics/${nodeId}/intro`);
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

export function updateSessionProgress(
  sessionId: string,
  body: { completion_percentage: number }
): Promise<SessionResponse> {
  return request<SessionResponse>(`/api/sessions/${sessionId}/progress`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ─── Diagnostic ──────────────────────────────────────

export function getDiagnosticProbe(
  sessionId: string
): Promise<DiagnosticProbe> {
  return request<DiagnosticProbe>(`/api/diagnostic/${sessionId}/probe`);
}

export function submitDiagnosticAnswer(
  sessionId: string,
  body: { node_id: string; answer: string }
): Promise<DiagnosticAnswer> {
  return request<DiagnosticAnswer>(`/api/diagnostic/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Content ─────────────────────────────────────────

export function generateContent(body: {
  node_id: string;
}): Promise<ContentResponse> {
  return request<ContentResponse>("/api/content/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Practice ────────────────────────────────────────

export function startPractice(body: {
  session_id: string;
  node_id: string;
}): Promise<PracticeStartResponse> {
  return request<PracticeStartResponse>("/api/practice/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitPracticeStep(body: {
  session_id: string;
  problem_id: string;
  step_index: number;
  student_step: string;
}): Promise<PracticeStepResponse> {
  return request<PracticeStepResponse>("/api/practice/submit-step", {
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

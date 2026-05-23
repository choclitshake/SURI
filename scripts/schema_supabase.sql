-- SURI PostgreSQL Schema for Supabase
-- Run this in the Supabase SQL Editor before importing data.

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade_level INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id),
    topic_entry_node TEXT NOT NULL,
    current_node TEXT NOT NULL,
    current_probe_index INTEGER,
    started_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    completion_percentage REAL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS diagnostic_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    node_id TEXT NOT NULL,
    probe_result INTEGER NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competency_status (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id),
    node_id TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'practice',
    updated_at TEXT NOT NULL,
    UNIQUE(student_id, node_id)
);

CREATE TABLE IF NOT EXISTS content_records (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL UNIQUE,
    lesson_text TEXT NOT NULL,
    worked_example TEXT NOT NULL,
    guided_explanation TEXT NOT NULL,
    source_doc TEXT NOT NULL,
    source_chunk_id TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    simplified_lesson_text TEXT
);

CREATE TABLE IF NOT EXISTS practice_problems (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    problem_expr TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    word_problem_text TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    node_id TEXT NOT NULL,
    problem_id TEXT NOT NULL REFERENCES practice_problems(id),
    student_steps_json TEXT NOT NULL,
    score INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    attempted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS misconception_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    practice_attempt_id TEXT NOT NULL REFERENCES practice_attempts(id),
    problem_id TEXT NOT NULL REFERENCES practice_problems(id),
    step_index INTEGER NOT NULL,
    step_description TEXT NOT NULL,
    mapped_node_id TEXT NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progression_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    node_id TEXT NOT NULL,
    mastery_score REAL NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('advance', 'remediate')),
    logged_at TEXT NOT NULL
);

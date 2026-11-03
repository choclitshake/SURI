-- SURI test schema.
--
-- Mirrors scripts/schema_supabase.sql plus the columns/tables the backend
-- code actually reads and writes today:
--   * students.email                      (auth_routes.py register/login/me)
--   * practice_problems.step_extras_json  (read by quiz_routes.py)
--   * quiz_sessions (+ current_streak)    (quiz_routes.py)
--   * practice_problems row id='batch'    (progression_routes.py batch attempts)
--
-- Every test starts from an empty copy of these tables (see conftest.py).

DROP TABLE IF EXISTS history_logs, topic_checks, quiz_sessions, progression_logs, misconception_logs,
    practice_attempts, practice_problems, content_records, competency_status,
    diagnostic_logs, sessions, students CASCADE;

CREATE TABLE students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    grade_level INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE sessions (
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

CREATE TABLE diagnostic_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    node_id TEXT NOT NULL,
    probe_result INTEGER NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE TABLE competency_status (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id),
    node_id TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'practice',
    updated_at TEXT NOT NULL,
    UNIQUE(student_id, node_id)
);

CREATE TABLE content_records (
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

CREATE TABLE practice_problems (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    problem_expr TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    word_problem_text TEXT,
    created_at TEXT NOT NULL,
    step_extras_json TEXT DEFAULT NULL,
    difficulty TEXT NOT NULL DEFAULT 'standard'  -- 'standard' | 'challenge' (quiz/practice sampling, challenge timers)
);

CREATE TABLE practice_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    node_id TEXT NOT NULL,
    problem_id TEXT NOT NULL REFERENCES practice_problems(id),
    student_steps_json TEXT NOT NULL,
    score INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    attempted_at TEXT NOT NULL
);

CREATE TABLE misconception_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    practice_attempt_id TEXT NOT NULL REFERENCES practice_attempts(id),
    problem_id TEXT NOT NULL REFERENCES practice_problems(id),
    step_index INTEGER NOT NULL,
    step_description TEXT NOT NULL,
    mapped_node_id TEXT NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE TABLE progression_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    node_id TEXT NOT NULL,
    mastery_score REAL NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('advance', 'remediate')),
    logged_at TEXT NOT NULL
);

CREATE TABLE quiz_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    problems_json TEXT NOT NULL,
    step_errors_json TEXT DEFAULT '[]',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    current_streak INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE history_logs (
    id            TEXT PRIMARY KEY,
    student_id    TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id    TEXT,
    kind          TEXT NOT NULL CHECK (kind IN ('quiz', 'practice', 'topic_check')),
    node_id       TEXT NOT NULL,
    score         INTEGER,
    total_correct INTEGER,
    total_steps   INTEGER,
    passed_count  INTEGER,
    passed        BOOLEAN,
    decision      TEXT CHECK (decision IN ('advance', 'remediate')),
    page_key      TEXT CHECK (page_key IN ('concept', 'example', 'explanation')),
    checked       BOOLEAN,
    logged_at     TEXT NOT NULL
);

CREATE TABLE topic_checks (
    student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    node_id     TEXT NOT NULL,
    page_key    TEXT NOT NULL CHECK (page_key IN ('concept', 'example', 'explanation')),
    checked     BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (student_id, node_id, page_key)
);
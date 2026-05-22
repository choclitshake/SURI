"""
Database connection and table setup for SURI.

Uses SQLite with aiosqlite for async operations.
All table creation runs on app startup.
"""

import aiosqlite
import os

DATABASE_URL = os.getenv("DATABASE_URL", "suri.db")

_TABLES_SQL = """
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
    generated_at TEXT NOT NULL
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
"""


async def _needs_competency_rebuild(db: aiosqlite.Connection) -> bool:
    """True if legacy CHECK constraint blocks new status values."""
    try:
        await db.execute(
            """
            INSERT INTO competency_status
            (id, student_id, node_id, status, source, updated_at)
            VALUES ('__schema_test__', '__none__', '__none__', 'in_progress', 'practice', '1970-01-01')
            """
        )
        await db.execute(
            "DELETE FROM competency_status WHERE id = '__schema_test__'"
        )
        return False
    except Exception:
        return True


async def _rebuild_competency_status_table(db: aiosqlite.Connection):
    """Recreate competency_status with source column and new status values."""
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS competency_status_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL REFERENCES students(id),
            node_id TEXT NOT NULL,
            status TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'practice',
            updated_at TEXT NOT NULL,
            UNIQUE(student_id, node_id)
        )
        """
    )
    cursor = await db.execute(
        "SELECT id, student_id, node_id, status, updated_at FROM competency_status"
    )
    rows = await cursor.fetchall()
    for row in rows:
        old_status = row["status"]
        if old_status == "weak":
            new_status, new_source = "unresolved", "diagnostic"
        elif old_status == "mastered":
            new_status, new_source = "mastered", "practice"
        else:
            new_status, new_source = old_status, "practice"
        await db.execute(
            """
            INSERT OR IGNORE INTO competency_status_new
            (id, student_id, node_id, status, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["student_id"],
                row["node_id"],
                new_status,
                new_source,
                row["updated_at"],
            ),
        )
    await db.execute("DROP TABLE IF EXISTS competency_status")
    await db.execute(
        "ALTER TABLE competency_status_new RENAME TO competency_status"
    )
    await db.commit()


async def get_db() -> aiosqlite.Connection:
    """Get an async database connection."""
    db = await aiosqlite.connect(DATABASE_URL)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db():
    """Create all tables on startup."""
    db = await aiosqlite.connect(DATABASE_URL)
    db.row_factory = aiosqlite.Row
    try:
        await db.executescript(_TABLES_SQL)
        await db.commit()

        # Migration: Ensure word_problem_text exists in practice_problems
        cursor = await db.execute("PRAGMA table_info(practice_problems)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "word_problem_text" not in columns:
            await db.execute("ALTER TABLE practice_problems ADD COLUMN word_problem_text TEXT")
            await db.commit()

        # Migration: Ensure simplified_lesson_text exists in content_records
        try:
            await db.execute(
                "ALTER TABLE content_records ADD COLUMN simplified_lesson_text TEXT"
            )
            await db.commit()
        except Exception:
            pass  # column already exists

        # Migration: competency_status source column and expanded status values
        try:
            await db.execute(
                "ALTER TABLE competency_status ADD COLUMN source TEXT DEFAULT 'practice'"
            )
            await db.commit()
        except Exception:
            pass

        if await _needs_competency_rebuild(db):
            await _rebuild_competency_status_table(db)

        # Sentinel row for batch practice_attempt summaries (FK target for problem_id='batch')
        await db.execute(
            """
            INSERT OR IGNORE INTO practice_problems (
                id, node_id, problem_expr, steps_json, word_problem_text, created_at
            ) VALUES ('batch', '_system', 'practice round summary', '[]', NULL, '1970-01-01T00:00:00+00:00')
            """
        )
        await db.commit()
    finally:
        await db.close()

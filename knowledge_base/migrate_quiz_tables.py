"""
migrate_quiz_tables.py -- Quiz Mode: Database Migration
=======================================================
Standalone offline script. Run ONCE before using quiz mode.

Creates:
  - quiz_sessions table
  - step_extras_json column on practice_problems (if not yet added)

Safe to run multiple times (idempotent).

Usage:
  python knowledge_base/migrate_quiz_tables.py
"""

import os
import sys
import asyncio
import asyncpg
from dotenv import load_dotenv

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")


async def migrate():
    print(f"Database: {DATABASE_URL}")
    print()

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # 1. Add step_extras_json to practice_problems
        # Check if column exists
        row = await conn.fetchrow(
            """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='practice_problems' AND column_name='step_extras_json';
            """
        )
        if not row:
            await conn.execute("ALTER TABLE practice_problems ADD COLUMN step_extras_json TEXT DEFAULT NULL")
            print("[OK] Added step_extras_json column to practice_problems.")
        else:
            print("[SKIP] step_extras_json already exists.")

        # 2. Create quiz_sessions table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS quiz_sessions (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                total_points INTEGER DEFAULT 0,
                problems_json TEXT NOT NULL,
                step_errors_json TEXT DEFAULT '[]',
                started_at TEXT NOT NULL,
                completed_at TEXT
            )
        """)
        print("[OK] quiz_sessions table ready.")

        print()
        print("Migration complete.")
    finally:
        await conn.close()


def main():
    print("=" * 60)
    print("SURI Quiz Mode -- Database Migration (PostgreSQL)")
    print("=" * 60)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)
    
    asyncio.run(migrate())


if __name__ == "__main__":
    main()

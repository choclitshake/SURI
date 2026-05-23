"""
Export pre-generated SURI data from suri.db to PostgreSQL-compatible SQL.

Exports ONLY:
  - practice_problems  (pre-generated problems, including the sentinel 'batch' row)
  - content_records    (pre-generated AI lesson content)

Run from the repo root:
  python scripts/export_sqlite_data.py
Outputs: scripts/seed_supabase.sql
"""

import sqlite3
import os
import re

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "suri.db")
OUT_PATH = os.path.join(os.path.dirname(__file__), "seed_supabase.sql")

TABLES = ["practice_problems", "content_records"]


def escape_value(val):
    """Convert a Python value to a PostgreSQL literal."""
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    # Escape single quotes by doubling them
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def export_table(cursor, table: str) -> list[str]:
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    col_names = [desc[0] for desc in cursor.description]

    if not rows:
        print(f"  [WARN] {table}: no rows found, skipping.")
        return []

    statements = []
    for row in rows:
        values = ", ".join(escape_value(v) for v in row)
        cols = ", ".join(col_names)
        stmt = f"INSERT INTO {table} ({cols}) VALUES ({values}) ON CONFLICT DO NOTHING;"
        statements.append(stmt)

    print(f"  [OK] {table}: {len(rows)} rows exported.")
    return statements


def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: suri.db not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    lines = [
        "-- SURI Seed Data for Supabase",
        "-- Generated from local suri.db",
        "-- Run this in the Supabase SQL Editor AFTER running schema_supabase.sql",
        "",
    ]

    for table in TABLES:
        lines.append(f"-- Table: {table}")
        stmts = export_table(cursor, table)
        lines.extend(stmts)
        lines.append("")

    conn.close()

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nDone! Seed SQL written to: {OUT_PATH}")


if __name__ == "__main__":
    main()

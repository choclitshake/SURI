"""
Load knowledge_base/content_seed.json into the content_records table.

Replaces existing lesson content for each node in the seed file so the API
serves offline seed data instead of old runtime-generated rows.

Usage (from project root):
  python knowledge_base/load_content_seed.py
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from dotenv import load_dotenv

load_dotenv(os.path.join(parent_dir, ".env"))

import sqlite3

from backend.graph import GRAPH

SEED_PATH = os.path.join(os.path.dirname(__file__), "content_seed.json")
DATABASE_URL = os.getenv("DATABASE_URL", "suri.db")
if not os.path.isabs(DATABASE_URL):
    DATABASE_URL = os.path.join(parent_dir, DATABASE_URL)


def field_to_text(value) -> str:
    """Normalize seed fields to TEXT columns (some nodes use nested objects)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if "problem" in value:
            parts = [str(value["problem"])]
            solution = value.get("solution")
            if isinstance(solution, list):
                parts.extend(str(step) for step in solution)
            elif solution is not None:
                parts.append(str(solution))
            return "\n".join(parts)
        return json.dumps(value, ensure_ascii=False, indent=2)
    if isinstance(value, list):
        return "\n".join(str(item) for item in value)
    return str(value)


def main() -> None:
    if not os.path.isfile(SEED_PATH):
        print(f"ERROR: Seed file not found: {SEED_PATH}")
        sys.exit(1)

    with open(SEED_PATH, encoding="utf-8") as f:
        seed = json.load(f)

    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    now = datetime.now(timezone.utc).isoformat()

    inserted = 0
    updated = 0
    skipped = 0

    try:
        for node_id, row in seed.items():
            if node_id not in GRAPH:
                print(f"SKIP {node_id}: not in GRAPH")
                skipped += 1
                continue

            lesson = field_to_text(row.get("lesson"))
            worked = field_to_text(row.get("worked_example"))
            guided = field_to_text(row.get("guided_explanation"))
            source_doc = row.get("source_doc") or "content_seed.json"

            existing = conn.execute(
                "SELECT id FROM content_records WHERE node_id = ?",
                (node_id,),
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE content_records
                    SET lesson_text = ?,
                        worked_example = ?,
                        guided_explanation = ?,
                        source_doc = ?,
                        source_chunk_id = ?,
                        generated_at = ?,
                        simplified_lesson_text = NULL
                    WHERE node_id = ?
                    """,
                    (
                        lesson,
                        worked,
                        guided,
                        source_doc,
                        "seed",
                        now,
                        node_id,
                    ),
                )
                updated += 1
                print(f"UPDATE {node_id} ({source_doc})")
            else:
                conn.execute(
                    """
                    INSERT INTO content_records (
                        id, node_id, lesson_text, worked_example,
                        guided_explanation, source_doc, source_chunk_id,
                        generated_at, simplified_lesson_text
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        str(uuid.uuid4()),
                        node_id,
                        lesson,
                        worked,
                        guided,
                        source_doc,
                        "seed",
                        now,
                    ),
                )
                inserted += 1
                print(f"INSERT {node_id} ({source_doc})")

        conn.commit()
    finally:
        conn.close()

    print("\n" + "=" * 50)
    print(f"Database: {DATABASE_URL}")
    print(f"Inserted: {inserted}  Updated: {updated}  Skipped: {skipped}")
    print("Entry nodes in DB:")
    for entry in ("QE", "SLE", "RER", "PE"):
        conn2 = sqlite3.connect(DATABASE_URL)
        row = conn2.execute(
            "SELECT source_doc, substr(lesson_text, 1, 60) FROM content_records WHERE node_id = ?",
            (entry,),
        ).fetchone()
        conn2.close()
        if row:
            print(f"  {entry}: {row[0]} — {row[1]!r}...")
        else:
            print(f"  {entry}: MISSING")
    print("=" * 50)


if __name__ == "__main__":
    main()

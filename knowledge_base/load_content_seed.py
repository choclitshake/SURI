"""
Load knowledge_base/content_seed.json into the content_records table on Supabase (PostgreSQL).

Replaces existing lesson content for each node in the seed file so the API
serves offline seed data instead of old runtime-generated rows.

Usage (from project root):
  python knowledge_base/load_content_seed.py
"""

import json
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from dotenv import load_dotenv

load_dotenv(os.path.join(parent_dir, ".env"))

import asyncpg

from backend.graph import GRAPH

SEED_PATH = os.path.join(os.path.dirname(__file__), "content_seed.json")
DATABASE_URL = os.getenv("DATABASE_URL", "")


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


async def async_main(seed: dict) -> None:
    if not os.path.isfile(SEED_PATH):
        print(f"ERROR: Seed file not found: {SEED_PATH}")
        sys.exit(1)

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL is not set in environment or .env file.")
        sys.exit(1)

    print(f"Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    now = datetime.now(timezone.utc).isoformat()

    inserted = 0
    updated = 0
    skipped = 0

    try:
        if True:  # Avoid PgBouncer deadlock
            for node_id, row in seed.items():
                if node_id not in GRAPH:
                    print(f"SKIP {node_id}: not in GRAPH")
                    skipped += 1
                    continue

                lesson = field_to_text(row.get("lesson"))
                worked = field_to_text(row.get("worked_example"))
                guided = field_to_text(row.get("guided_explanation"))
                source_doc = row.get("source_doc") or "content_seed.json"

                existing = await conn.fetchrow(
                    "SELECT id FROM content_records WHERE node_id = $1",
                    node_id,
                )

                if existing:
                    await conn.execute(
                        """
                        UPDATE content_records
                        SET lesson_text = $1,
                            worked_example = $2,
                            guided_explanation = $3,
                            source_doc = $4,
                            source_chunk_id = $5,
                            generated_at = $6,
                            simplified_lesson_text = NULL
                        WHERE node_id = $7
                        """,
                        lesson,
                        worked,
                        guided,
                        source_doc,
                        "seed",
                        now,
                        node_id,
                    )
                    updated += 1
                    print(f"UPDATE {node_id} ({source_doc})")
                else:
                    await conn.execute(
                        """
                        INSERT INTO content_records (
                            id, node_id, lesson_text, worked_example,
                            guided_explanation, source_doc, source_chunk_id,
                            generated_at, simplified_lesson_text
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
                        """,
                        str(uuid.uuid4()),
                        node_id,
                        lesson,
                        worked,
                        guided,
                        source_doc,
                        "seed",
                        now,
                    )
                    inserted += 1
                    print(f"INSERT {node_id} ({source_doc})")

        print("\n" + "=" * 50)
        print("Verification - Entry nodes in DB:")
        for entry in ("QE", "SLE", "RER", "PE"):
            row = await conn.fetchrow(
                "SELECT source_doc, lesson_text FROM content_records WHERE node_id = $1",
                entry,
            )
            if row:
                preview = row[1][:60] if row[1] else ""
                print(f"  {entry}: {row[0]} — {preview!r}...")
            else:
                print(f"  {entry}: MISSING")
        print("=" * 50)

    except Exception as e:
        print(f"ERROR during database operation: {e}")
        sys.exit(1)
    finally:
        await conn.close()

    print(f"\nDatabase: Seeding completed successfully.")
    print(f"Inserted: {inserted}  Updated: {updated}  Skipped: {skipped}")


def main() -> None:
    if not os.path.isfile(SEED_PATH):
        print(f"ERROR: Seed file not found: {SEED_PATH}")
        sys.exit(1)

    with open(SEED_PATH, encoding="utf-8") as f:
        seed = json.load(f)

    asyncio.run(async_main(seed))


if __name__ == "__main__":
    main()

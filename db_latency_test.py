"""
Run this directly: python3 db_latency_test.py

Measures raw connect time and per-query time against Supabase,
completely bypassing FastAPI/uvicorn/the connection pool, so we can see
whether the delay is network/connection-related or something in the app.
"""

import asyncio
import os
import time

import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def main():
    print(f"Connecting to: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else '(check .env)'}")

    t0 = time.perf_counter()
    conn = await asyncpg.connect(dsn=DATABASE_URL, statement_cache_size=0)
    t1 = time.perf_counter()
    print(f"Initial connect: {(t1 - t0) * 1000:.0f}ms")

    # Run the same simple query 5 times over the SAME already-open connection
    for i in range(5):
        qt0 = time.perf_counter()
        await conn.fetchrow("SELECT 1")
        qt1 = time.perf_counter()
        print(f"Query {i + 1} (SELECT 1): {(qt1 - qt0) * 1000:.0f}ms")

    await conn.close()

    # Now test opening a FRESH connection each time (simulates cold connects)
    print("\n--- Fresh connection each time ---")
    for i in range(3):
        ct0 = time.perf_counter()
        c = await asyncpg.connect(dsn=DATABASE_URL, statement_cache_size=0)
        await c.fetchrow("SELECT 1")
        ct1 = time.perf_counter()
        await c.close()
        print(f"Fresh connect + query {i + 1}: {(ct1 - ct0) * 1000:.0f}ms")


asyncio.run(main())
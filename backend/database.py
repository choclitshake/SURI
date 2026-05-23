"""
Database connection pool for SURI using asyncpg (PostgreSQL / Supabase).

Replaces the previous aiosqlite SQLite implementation.
The pool is initialized once on app startup and shared across all requests.
"""

import os
import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "")

_pool: asyncpg.Pool | None = None


async def init_pool():
    """Create the asyncpg connection pool. Called once on app startup."""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=2,
        max_size=10,
        statement_cache_size=0,  # Required for Supabase transaction pooler (PgBouncer)
    )


async def close_pool():
    """Close the connection pool. Called on app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> asyncpg.Connection:
    """
    Acquire a connection from the pool.

    Usage in route handlers:
        async with await get_db() as conn:
            row = await conn.fetchrow("SELECT ...")

    Or acquire/release manually:
        conn = await get_db()
        try:
            ...
        finally:
            await conn.close()  # returns connection to pool
    """
    if _pool is None:
        raise RuntimeError("Database pool is not initialized. Call init_pool() first.")
    return await _pool.acquire()


async def release_db(conn: asyncpg.Connection):
    """Return a connection back to the pool."""
    if _pool and conn:
        await _pool.release(conn)

import os
import asyncpg
import pytest_asyncio

from app import db

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://localhost/tatkal_test")


@pytest_asyncio.fixture
async def db_pool():
    pool = await asyncpg.create_pool(TEST_DATABASE_URL, min_size=50, max_size=50)
    async with pool.acquire() as conn:
        await db.reset(conn, seats=50)
    try:
        yield pool
    finally:
        await pool.close()

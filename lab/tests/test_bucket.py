import asyncio
import pytest
import pytest_asyncio
import redis.asyncio as aioredis

from app.bucket import RedisTokenBucket


@pytest_asyncio.fixture
async def redis_client():
    client = aioredis.from_url(
        "redis://localhost:6379/15",
        decode_responses=True,
        max_connections=256,
    )
    await client.flushdb()
    try:
        yield client
    finally:
        await client.flushdb()
        await client.aclose()


async def test_capacity_without_refill(redis_client):
    bucket = RedisTokenBucket(redis_client, "test:cap", capacity=5, refill_per_sec=0)
    results = [await bucket.take(now_ms=0) for _ in range(5)]
    assert results == [True, True, True, True, True]
    assert await bucket.take(now_ms=0) is False


async def test_linear_refill(redis_client):
    bucket = RedisTokenBucket(redis_client, "test:refill", capacity=5, refill_per_sec=10)
    for _ in range(5):
        assert await bucket.take(now_ms=0) is True
    assert await bucket.take(now_ms=50) is False
    assert await bucket.take(now_ms=100) is True
    assert await bucket.take(now_ms=100) is False


async def test_atomic_under_concurrency(redis_client):
    bucket = RedisTokenBucket(redis_client, "test:concurrent", capacity=50, refill_per_sec=0)
    results = await asyncio.gather(*(bucket.take(now_ms=0) for _ in range(200)))
    assert sum(1 for r in results if r) == 50
    assert sum(1 for r in results if not r) == 150

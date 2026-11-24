from contextlib import asynccontextmanager
import os
import asyncpg
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import redis.asyncio as aioredis

from app import db
from app.bucket import RedisTokenBucket
from app.seats import book

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost/tatkal_lab")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
BUCKET_KEY = "tatkal:bucket"


class BookRequest(BaseModel):
    passenger: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await asyncpg.create_pool(DATABASE_URL, min_size=50, max_size=50)
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True, max_connections=256)
    app.state.bucket = RedisTokenBucket(
        app.state.redis,
        BUCKET_KEY,
        capacity=375,
        refill_per_sec=1500,
    )
    try:
        yield
    finally:
        await app.state.redis.aclose()
        await app.state.pool.close()


app = FastAPI(title="Tatkal Trainer Lab", lifespan=lifespan)


@app.post("/reset")
async def reset_lab(seats: int = Query(128, ge=1, le=2000)):
    async with app.state.pool.acquire() as conn:
        await db.reset(conn, seats=seats)
    await app.state.redis.delete(BUCKET_KEY)
    return {"ok": True, "seats": seats}


@app.post("/book")
async def book_seat(
    body: BookRequest,
    strategy: str = Query("skip_locked"),
    limit: str = Query("on"),
):
    if limit == "on":
        allowed = await app.state.bucket.take()
        if not allowed:
            return JSONResponse(status_code=429, content={"status": "FAILED_429"})

    async with app.state.pool.acquire() as conn:
        result = await book(conn, strategy, body.passenger)
    return result


@app.get("/stats")
async def get_stats():
    async with app.state.pool.acquire() as conn:
        return await db.stats(conn)

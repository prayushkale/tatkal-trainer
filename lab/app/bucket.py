from pathlib import Path
import time
import redis.asyncio as aioredis

LUA_PATH = Path(__file__).resolve().parent / "token_bucket.lua"
LUA_SOURCE = LUA_PATH.read_text(encoding="utf-8")


class RedisTokenBucket:
    def __init__(
        self,
        redis_client: aioredis.Redis,
        key: str,
        capacity: float,
        refill_per_sec: float,
    ) -> None:
        self.redis = redis_client
        self.key = key
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self._script = redis_client.register_script(LUA_SOURCE)

    async def take(self, now_ms: int | None = None) -> bool:
        ts = time.monotonic_ns() // 1_000_000 if now_ms is None else now_ms
        allowed = await self._script(
            keys=[self.key],
            args=[self.capacity, self.refill_per_sec, ts],
        )
        return int(allowed) == 1

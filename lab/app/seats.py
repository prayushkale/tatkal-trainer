import asyncio
import asyncpg


async def fare_check() -> None:
    await asyncio.sleep(0.005)


async def book_naive(conn: asyncpg.Connection, passenger: str) -> dict[str, str]:
    async with conn.transaction():
        row = await conn.fetchrow(
            "SELECT id, label FROM seats WHERE status='free' ORDER BY id LIMIT 1"
        )
        if row is None:
            return {"status": "REGRET"}
        await fare_check()
        await conn.execute("UPDATE seats SET status='booked' WHERE id=$1", row["id"])
        await conn.execute(
            "INSERT INTO bookings(seat_id, passenger) VALUES ($1, $2)",
            row["id"],
            passenger,
        )
        return {"status": "CNF", "seat": row["label"]}


async def book_for_update(conn: asyncpg.Connection, passenger: str) -> dict[str, str]:
    async with conn.transaction():
        row = await conn.fetchrow(
            "SELECT id, label FROM seats WHERE status='free' ORDER BY id LIMIT 1 FOR UPDATE"
        )
        if row is None:
            return {"status": "REGRET"}
        await fare_check()
        await conn.execute("UPDATE seats SET status='booked' WHERE id=$1", row["id"])
        await conn.execute(
            "INSERT INTO bookings(seat_id, passenger) VALUES ($1, $2)",
            row["id"],
            passenger,
        )
        return {"status": "CNF", "seat": row["label"]}


async def book_skip_locked(conn: asyncpg.Connection, passenger: str) -> dict[str, str]:
    async with conn.transaction():
        row = await conn.fetchrow(
            "SELECT id, label FROM seats WHERE status='free' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED"
        )
        if row is None:
            return {"status": "REGRET"}
        await fare_check()
        await conn.execute("UPDATE seats SET status='booked' WHERE id=$1", row["id"])
        await conn.execute(
            "INSERT INTO bookings(seat_id, passenger) VALUES ($1, $2)",
            row["id"],
            passenger,
        )
        return {"status": "CNF", "seat": row["label"]}


async def book(conn: asyncpg.Connection, strategy: str, passenger: str) -> dict[str, str]:
    if strategy == "naive":
        return await book_naive(conn, passenger)
    if strategy == "for_update":
        return await book_for_update(conn, passenger)
    if strategy == "skip_locked":
        return await book_skip_locked(conn, passenger)
    raise ValueError(f"unknown strategy: {strategy}")

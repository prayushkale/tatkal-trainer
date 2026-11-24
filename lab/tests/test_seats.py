import asyncio
import time
import pytest

from app import db
from app.seats import book


@pytest.mark.parametrize(
    "strategy",
    [
        pytest.param(
            "naive",
            marks=pytest.mark.xfail(strict=True, reason="reproduces the double-booking bug"),
        ),
        "for_update",
        "skip_locked",
    ],
)
async def test_no_seat_sold_twice(db_pool, strategy):
    async def attempt(i: int):
        async with db_pool.acquire() as conn:
            return await book(conn, strategy, f"p{i}")

    t0 = time.perf_counter()
    results = await asyncio.gather(*(attempt(i) for i in range(200)))
    elapsed_ms = (time.perf_counter() - t0) * 1000

    async with db_pool.acquire() as conn:
        st = await db.stats(conn)

    cnf = sum(1 for r in results if r["status"] == "CNF")
    regret = sum(1 for r in results if r["status"] == "REGRET")

    print(
        f"\n[{strategy}] elapsed={elapsed_ms:.1f}ms cnf={cnf} regret={regret} "
        f"bookings={st['bookings']} distinct={st['distinct_seats']} "
        f"double_booked={st['double_booked_seats']}"
    )

    assert st["double_booked_seats"] == 0, f"double-booked seats: {st}"
    assert st["bookings"] == 50 and st["distinct_seats"] == 50, f"bad seat totals: {st}"
    assert cnf == 50 and regret == 150

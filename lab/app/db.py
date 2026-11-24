from pathlib import Path
import asyncpg

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema.sql"


def seat_label(index: int) -> str:
    coach = (index // 64) + 1
    berth = (index % 64) + 1
    return f"B{coach}/{berth}"


async def reset(conn: asyncpg.Connection, seats: int) -> None:
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    await conn.execute(schema_sql)
    labels = [(seat_label(i),) for i in range(seats)]
    await conn.executemany("INSERT INTO seats(label) VALUES ($1)", labels)


async def stats(conn: asyncpg.Connection) -> dict[str, int]:
    row = await conn.fetchrow(
        """
        SELECT
          COUNT(*)::int AS bookings,
          COUNT(DISTINCT seat_id)::int AS distinct_seats,
          (
            SELECT COUNT(*)::int
            FROM (
              SELECT seat_id
              FROM bookings
              GROUP BY seat_id
              HAVING COUNT(*) > 1
            ) dupes
          ) AS double_booked_seats
        FROM bookings
        """
    )
    return {
        "bookings": row["bookings"],
        "distinct_seats": row["distinct_seats"],
        "double_booked_seats": row["double_booked_seats"],
    }

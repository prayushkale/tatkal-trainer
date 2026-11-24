import argparse
import asyncio
import time
import httpx


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, max(0, int(round((p / 100.0) * (len(sorted_vals) - 1)))))
    return sorted_vals[idx]


async def run_load(
    base: str,
    strategy: str,
    requests: int,
    concurrency: int,
    limit: str,
) -> None:
    limits = httpx.Limits(
        max_connections=max(concurrency + 20, 250),
        max_keepalive_connections=max(concurrency + 20, 250),
    )
    async with httpx.AsyncClient(base_url=base, timeout=30.0, limits=limits) as client:
        r = await client.post("/reset", params={"seats": 128})
        r.raise_for_status()

        sem = asyncio.Semaphore(concurrency)
        latencies_ms: list[float] = []
        counts = {"CNF": 0, "REGRET": 0, "429": 0, "ERR": 0}

        async def worker(i: int) -> None:
            async with sem:
                t0 = time.perf_counter()
                try:
                    resp = await client.post(
                        "/book",
                        params={"strategy": strategy, "limit": limit},
                        json={"passenger": f"p{i}"},
                    )
                    dt = (time.perf_counter() - t0) * 1000.0
                    latencies_ms.append(dt)
                    if resp.status_code == 429:
                        counts["429"] += 1
                    elif resp.status_code == 200:
                        status = resp.json().get("status", "ERR")
                        counts[status] = counts.get(status, 0) + 1
                    else:
                        counts["ERR"] += 1
                except Exception:
                    counts["ERR"] += 1

        wall_t0 = time.perf_counter()
        await asyncio.gather(*(worker(i) for i in range(requests)))
        wall_ms = (time.perf_counter() - wall_t0) * 1000.0

        stats_resp = await client.get("/stats")
        stats_resp.raise_for_status()
        st = stats_resp.json()

    latencies_ms.sort()
    p50 = percentile(latencies_ms, 50)
    p99 = percentile(latencies_ms, 99)

    print(f"### load.py --strategy {strategy} --limit {limit} (requests={requests}, concurrency={concurrency})")
    print("| Strategy | Limit | CNF | REGRET | 429 | Bookings | Distinct | Double-booked | p50 (ms) | p99 (ms) | Wall (ms) |")
    print("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    print(
        f"| {strategy} | {limit} | {counts['CNF']} | {counts['REGRET']} | {counts['429']} | "
        f"{st['bookings']} | {st['distinct_seats']} | {st['double_booked_seats']} | "
        f"{p50:.1f} | {p99:.1f} | {wall_ms:.1f} |"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Tatkal Trainer FastAPI lab load tester")
    parser.add_argument("--strategy", default="skip_locked", choices=["naive", "for_update", "skip_locked"])
    parser.add_argument("--requests", type=int, default=2000)
    parser.add_argument("--concurrency", type=int, default=200)
    parser.add_argument("--limit", default="on", choices=["on", "off"])
    parser.add_argument("--base", default="http://localhost:8000")
    args = parser.parse_args()
    asyncio.run(run_load(args.base, args.strategy, args.requests, args.concurrency, args.limit))


if __name__ == "__main__":
    main()

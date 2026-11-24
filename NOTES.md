# NOTES: Tatkal Trainer (System Design, Visualized #1)

Model credit: Built with Claude Opus 5.5
Live: https://tatkal-trainer.prayushkale.workers.dev
Repo: https://github.com/prayushkale/tatkal-trainer
DEMO_SEED: 5 (at +300 ms: `WL 1086`, blame `bucket`; note below on why `WL 347` + `blame=bucket` is mathematically unreachable at 1,500 req/s and burst 375)

## What failed (prompt or model → what broke → fix that worked)
| When | Prompt / model | What broke | Fix that worked |
|------|----------------|------------|-----------------|
| step 8 | initial DEFAULTS (`fastShare: 0.6, fastMeanMs: 80, slowMeanMs: 1200, waitlistCap: 600`) | 30,000 bots flooded the 1,500 req/s bucket in 80 ms: at +300 ms user got 0 WL (42/50 got 429) and `--fair` capped at 10.5% FCFS because 65 ms latency spread swamped the 0.34 ms click spread of the first 128 bots | Tuned only the 6 allowed arrival/retry/waitlist params (`fastShare: 0.85, fastMeanMs: 14000, slowMeanMs: 150000, retryBackoffMs: 25, retryJitterMs: 30, waitlistCap: 1500`): +300 ms gives 0/50 CNF, 34/50 WL (68%), 33/50 bucket blame, seats gone in 196 ms, and `--fair` hits 80.1% FCFS |
| step 8 | target `WL 347` with `blame=bucket` at +300 ms under fixed `rateLimitPerSec=1500, burstSeconds=0.25` | Hard mathematical floor: for the bucket to reject a +300 ms click (arriving at +392 ms) under decreasing arrival density, at least `375 + (392-80)*1.5 = 843` tokens were already granted before t1, forcing `WL >= 715` (~936–1086 after retry) | Kept `1,500 req/s` and `burst 375` untouched as specified; documented the real median WL (`936` at +300 ms) and real `DEMO_SEED=5` (`WL 1086`, blame `bucket`) instead of faking a number |
| step 9 | `redis.asyncio.from_url(...)` default pool size under `asyncio.gather` of 200 concurrent `take()` calls | `redis.exceptions.MaxConnectionsError: Too many connections` in redis-py 8.2.0 | Passed `max_connections=256` to `redis.asyncio.from_url(...)` in test fixture and FastAPI lifespan |
| step 10 | naive seat booking (`SELECT ... LIMIT 1`, 5 ms `fare_check`, `UPDATE` + `INSERT`) | 200 bookings for 50 seats across only 7 distinct seats; all 7 seats sold multiple times (~28x each) in 48.0 ms. (Honest note: the 5 ms `fare_check` widens the race window so it reproduces on every run.) | `SELECT id, label FROM seats WHERE status='free' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED` -> 50 bookings, 50 distinct seats, 0 double-booked in 26.8 ms (`for_update` without `SKIP LOCKED` also had 0 double-booked, but took 363.3 ms — 13.6x slower due to row lock serialization) |

## Numbers
### Sim (npm run sweep): delay table, --fair grid, final DEFAULTS

Final `DEFAULTS`:
```ts
bots: 50_000, seats: 128, waitlistCap: 1500,
lbNodes: 4, lbMs: 2,
rateLimitPerSec: 1500, burstSeconds: 0.25,
queueSize: 1000, queueTimeoutMs: 2500,
workers: 8, serviceMs: 10,
fastShare: 0.85, fastMeanMs: 14_000, slowMeanMs: 150_000,
botLatencyMinMs: 15, botLatencyMaxMs: 80, userLatencyMs: 90,
maxRetries: 2, retryBackoffMs: 25, retryJitterMs: 30
```

#### Delay sweep (seeds 1..50 at DEFAULTS)
| Delay (ms) | CNF | WL | REGRET | 429 | QFull | Timeout | Med WL | Top Blame | Med SeatsGone (ms) | Med FCFS |
|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 100 | 0 | 50 | 0 | 0 | 0 | 0 | 312 | lock (50) | 196 | 80.5% |
| 200 | 0 | 45 | 0 | 5 | 0 | 0 | 609 | lock (43) | 196 | 80.5% |
| 300 | 0 | 34 | 1 | 15 | 0 | 0 | 936 | bucket (33) | 196 | 80.5% |
| 400 | 0 | 24 | 2 | 22 | 2 | 0 | 933 | bucket (33) | 196 | 80.5% |
| 600 | 0 | 9 | 15 | 21 | 5 | 0 | 1230 | bucket (41) | 196 | 80.5% |
| 1000 | 0 | 0 | 15 | 26 | 9 | 0 | - | bucket (43) | 196 | 80.5% |
| 2000 | 0 | 0 | 12 | 24 | 14 | 0 | - | bucket (38) | 196 | 80.5% |

#### Fairness grid (`--fair`, seeds 1..20, userDelay 300 ms)
| Rate (req/s) | Queue | Med FCFS | Med Failed Share | Med Failed Count |
|---:|---:|---:|---:|---:|
| 200 | 10 | 38.3% | 67.6% | 33,780 |
| 200 | 100 | 50.8% | 67.5% | 33,764 |
| 200 | 1,000 | 50.8% | 67.5% | 33,764 |
| 200 | 10,000 | 50.8% | 67.5% | 33,764 |
| 200 | 50,000 | 50.8% | 67.5% | 33,764 |
| 500 | 10 | 46.5% | 47.9% | 23,975 |
| 500 | 100 | 80.1% | 47.8% | 23,885 |
| 500 | 1,000 | 80.1% | 47.8% | 23,881 |
| 500 | 10,000 | 80.1% | 47.8% | 23,881 |
| 500 | 50,000 | 80.1% | 47.8% | 23,881 |
| 800 | 10 | 47.7% | 34.3% | 17,169 |
| 800 | 100 | 80.1% | 34.1% | 17,062 |
| 800 | 1,000 | 80.1% | 33.9% | 16,963 |
| 800 | 10,000 | 80.1% | 33.9% | 16,963 |
| 800 | 50,000 | 80.1% | 33.9% | 16,963 |
| 1,500 | 10 | 47.7% | 34.5% | 17,251 |
| 1,500 | 100 | 80.1% | 34.2% | 17,117 |
| 1,500 | 1,000 | 80.1% | 32.4% | 16,217 |
| 1,500 | 10,000 | 80.1% | 30.4% | 15,217 |
| 1,500 | 50,000 | 80.1% | 30.4% | 15,217 |
| 5,000 | 10 | 47.7% | 34.5% | 17,251 |
| 5,000 | 100 | 80.1% | 34.2% | 17,117 |
| 5,000 | 1,000 | 80.1% | 32.4% | 16,217 |
| 5,000 | 10,000 | 80.1% | 30.4% | 15,217 |
| 5,000 | 50,000 | 80.1% | 30.4% | 15,217 |
| 20,000 | 10 | 47.7% | 34.5% | 17,251 |
| 20,000 | 100 | 80.1% | 34.2% | 17,117 |
| 20,000 | 1,000 | 80.1% | 32.4% | 16,217 |
| 20,000 | 10,000 | 80.1% | 30.4% | 15,217 |
| 20,000 | 50,000 | 80.1% | 30.4% | 15,217 |

### Lab (pytest + load.py): naive / for_update / skip_locked / skip_locked+limit

#### Unit concurrency test (`pytest -q -s tests/test_seats.py`, 200 concurrent bookers vs 50 seats, 5 ms `fare_check`):
- `naive`: 48.0 ms — 200 bookings, 7 distinct seats, **7 double-booked seats** (strict xfail)
- `for_update`: 363.3 ms — 50 bookings, 50 distinct seats, **0 double-booked seats** (13.6x slower than `skip_locked`)
- `skip_locked`: 26.8 ms — 50 bookings, 50 distinct seats, **0 double-booked seats**

#### FastAPI load test (`load.py`, 2000 requests, concurrency 200, 128 seats):

| Strategy | Limit | CNF | REGRET | 429 | Bookings | Distinct | Double-booked | p50 (ms) | p99 (ms) | Wall (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| naive | off | 352 | 1648 | 0 | 352 | 128 | 101 | 338.1 | 3757.0 | 6421.7 |
| for_update | off | 128 | 1872 | 0 | 128 | 128 | 0 | 353.7 | 5254.7 | 8367.0 |
| skip_locked | off | 128 | 1872 | 0 | 128 | 128 | 0 | 337.9 | 2793.1 | 5654.6 |
| skip_locked | on | 128 | 1872 | 0 | 128 | 128 | 0 | 389.9 | 3158.0 | 6355.3 |

Note on `skip_locked --limit on`: single-process uvicorn processed ~315 req/s locally (below the 1,500 req/s bucket refill rate), so 0 requests hit 429; token bucket atomicity and rejection under concurrency are proven directly by `tests/test_bucket.py` (200 concurrent Redis calls against capacity 50 -> 50 allowed, 150 rejected).

### Perf: runRace default wall time

- Initial DEFAULTS: `runRace(DEFAULTS, 1, 300)` on Apple Silicon Mac (Node v26.13.1 via tsx): **35.13 ms** cold, **35.88 ms** warm.
- Tuned DEFAULTS: `runRace(DEFAULTS, 1, 300)` on Apple Silicon Mac: **35.17 ms** cold, **23.07 ms** warm (target: < 100 ms).

### Verification summaries

- `web` unit tests (`npm run test:unit -- --run`): `Test Files 5 passed (5) · Tests 23 passed (23)`
- `web` type-check / lint / build: `vue-tsc --build` 0 errors, `oxlint` 0 errors / 0 warnings, `eslint` 0 errors, `vite build` clean (143 ms)
- `web` E2E (`npm run test:e2e`): `4 passed (12.4s)` (race flow + 1280x800 & 390x844 screenshots + 1200x630 `og.png`)
- `lab` pytest (`pytest -q`): `5 passed, 1 xfailed in 0.75s` (3 Redis bucket tests + `for_update` + `skip_locked` passing; `naive` strict xfail)
- Live deploy E2E (`BASE_URL=https://tatkal-trainer.prayushkale.workers.dev npx playwright test e2e/race.spec.ts`): `1 passed (3.6s)` + `og.png` HTTP 200 OK

## Thread draft inputs
- Hook: "Tatkal opens at 10:00:00 and is gone by 10:00:03. So I built a trainer where you can practise losing, and see which part of the system rejected you."
- At +0.3 s click: 0 of 50 races won, 34 of 50 landed on waitlist (median WL 936), 15 of 50 died with 429, 33 of 50 blamed on the token bucket, all 128 seats gone in 196 ms.
- Lab proof: naive `SELECT ... LIMIT 1` double-booked 7 of 50 seats (200 bookings on 7 seats in 48 ms); `FOR UPDATE` fixed correctness at 363 ms; `FOR UPDATE SKIP LOCKED` fixed both correctness and speed at 27 ms (13.6x faster).

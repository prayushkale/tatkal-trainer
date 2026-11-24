# PLAN.md: Tatkal Trainer (practise losing a ticket at 10:00:00)

You are running this plan in an empty project folder with no other context. Every decision below is already made. Do not ask questions. Where a step says "record in NOTES.md", do it at that step and not later.

---

## 1. Context

**What it is.** A browser game where a countdown runs to 10:00:00 on a retro train-booking screen. You race 50,000 simulated bots to press **Book Now**. Most of the time you lose. Then the screen splits. On the left is your result (`CNF B2/34`, `WL 347`, `REGRET`, or `FAILED: 429`). On the right is a toy backend: load balancer → Redis token bucket → queue → workers → Postgres seat lock. It shows exactly which stage rejected your request and how many milliseconds each stage took. Two sliders (rate limit and queue size) let the reader re-run the same race and try to make it fair.

**Why.** Everyone in India has lost a Tatkal ticket. A live link people can play gets shared, because people post their waitlist number. It also gets bookmarked, because it teaches rate limiting, queueing and row locking with a pain everyone already knows.

**The backend is my own toy model, not IRCTC's real design.** Say this in the UI footer, in the README and in the thread. Do not use IRCTC or Indian Railways logos, names-as-branding, colours or screenshots. The train shown is fictional.

**The post shape it copies.** Reference: **@the2ndfloorguy**, X Article: *"i tracked my relationships for 6 years. new friends are negative roi. here is the math."* The shape is a deadpan, slightly absurd personal project aimed at a pain everyone shares, followed by real numbers ("here is the math"). Pattern: **Absurd fix for a relatable pain**. The absurd fix: you can't win Tatkal, so practise losing, and at least learn which part of the system rejected you.

**Series:** System Design, Visualized #1.

**Live trend:** the brief has none. It rides the evergreen 10 AM Tatkal pain. Do not claim a trend or news hook in the thread.

**Hook (use verbatim in the thread):** "Tatkal opens at 10:00:00 and is gone by 10:00:03. So I built a trainer where you can practise losing, and see which part of the system rejected you."

**Demo shot (first 2 seconds of the video):** the countdown ticks 09:59:58 → 10:00:00, the user clicks Book, the screen flips to `WL 347`, and the pipeline diagram lights the token bucket in red.

**Model credit:** "Built with Claude Opus 5.5"

---

## 2. Stack and setup

Only the creator's stack: **TypeScript + Vue 3** (the game, all simulation runs in the browser so the live link costs nothing), **Python/FastAPI + Redis + PostgreSQL** (a local `lab/` that proves the token bucket and the seat-lock bug and fix for real, with real numbers for the thread). AWS is in the stack but is not used this weekend: the game is static and ships free on Cloudflare (see §5, which follows the creator's Cloudflare rule).

Tooling decisions:
- Node 22 LTS (Vite needs ≥ 20.19 / 22.12), npm, `create-vue` with Vitest + Playwright + ESLint. No router, no Pinia.
- `tsx` to run the sweep script. `wrangler` for deploy (a `wrangler.jsonc` lives in `web/`, so use Wrangler and not `cf`).
- Python 3.12, `venv` + `pip`, FastAPI, uvicorn, asyncpg, redis-py (asyncio), httpx, pytest, pytest-asyncio.
- Postgres 17 and Redis from Homebrew, run as `brew services` (macOS).
- Use `gh` for GitHub.
- Before writing code against any library API (Vue 3 `<script setup>`, Vite, Vitest, Playwright config, FastAPI lifespan, asyncpg pools/transactions, redis-py `register_script`, Wrangler static-assets config, Postgres `FOR UPDATE SKIP LOCKED`), **look up current docs with Context7** and don't rely on memory.
- If the Serena MCP is connected, use its symbol tools to navigate code and don't read whole files.
- One feature, built in order on `main`. No worktrees are needed because nothing runs in parallel.

### Setup commands (run from the empty project folder)

```bash
# 0. Prereqs: check them, install only what's missing
node -v            # must be >= 22.12 (or 20.19)
python3 --version  # must be >= 3.12
gh auth status
brew --version

# 1. Repo
git init -b main

# 2. Web app (Vue 3 + TS + Vitest + Playwright + ESLint)
npm create vue@latest web -- --ts --vitest --playwright --eslint --bare
#   If --bare is not accepted (check: npm create vue@latest -- --help), drop it and
#   delete the example components/assets in step 2 below.
#   If it still prompts: No to JSX, Router, Pinia, Prettier and any experimental features.
cd web
npm install
npm install -D tsx wrangler
npx playwright install chromium
cd ..

# 3. Lab services
brew install postgresql@17 redis
brew services start postgresql@17
brew services start redis
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"
createdb tatkal_lab
createdb tatkal_test

# 4. Lab Python env
mkdir -p lab/app lab/tests
cd lab
python3 -m venv .venv
source .venv/bin/activate
# (requirements.txt is written in build step 3, then:)
# pip install -r requirements.txt
cd ..
```

### Final file tree (target)

```
.
├── .gitignore
├── README.md
├── NOTES.md
├── DESIGN.md
├── PLAN.md
├── lab/
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── schema.sql
│   ├── load.py
│   ├── app/__init__.py
│   ├── app/main.py
│   ├── app/db.py
│   ├── app/seats.py
│   ├── app/bucket.py
│   ├── app/token_bucket.lua
│   └── tests/{conftest.py,test_bucket.py,test_seats.py}
└── web/
    ├── wrangler.jsonc
    ├── index.html
    ├── package.json            (scripts added)
    ├── playwright.config.ts    (baseURL override added)
    ├── public/{favicon.svg,og.png}
    ├── scripts/sweep.ts
    ├── e2e/{race.spec.ts,screens.spec.ts}
    └── src/
        ├── main.ts
        ├── App.vue
        ├── styles/{tokens.css,retro.css,backend.css}
        ├── sim/{types.ts,defaults.ts,rng.ts,heap.ts,tokenBucket.ts,race.ts,format.ts}
        ├── sim/__tests__/{rng.spec.ts,heap.spec.ts,tokenBucket.spec.ts,race.spec.ts,format.spec.ts}
        ├── composables/{useCountdown.ts,useUrlParams.ts,usePracticeLog.ts}
        └── components/{BookingScreen.vue,LedClock.vue,WaitingBar.vue,TicketResult.vue,
                        PipelineView.vue,ParticleLayer.vue,YourTimeline.vue,
                        ControlSliders.vue,StageDrawer.vue,ShareButton.vue}
```

---

## 3. Build steps

Commit after each step that ends green: `git add -A && git commit -m "<step summary>"`.

### Step 1: Root files (15 min)

- `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.env*`, `test-results/`, `playwright-report/`, `web/screens/`, `recordings/`, `.wrangler/`, `.DS_Store`.
- `README.md`: a title, one line ("Race 50,000 bots to a Tatkal ticket, then see which part of a toy backend rejected you."), a "Live:" placeholder, how to run `web/` and `lab/`, the disclaimer "Toy model I wrote. Not IRCTC's real architecture. Not affiliated with IRCTC or Indian Railways.", and the footer "Built with Claude Opus 5.5".
- `NOTES.md`: the template from §7.
- `DESIGN.md`: the design source of truth. It wins over any skill defaults. Contents:
  - **Two worlds, one screen.** The left is the *booking world*: a 2000s government-web-form look. The right is the *backend world*: a dark ops diagram.
  - **Booking world palette:** page `#E9E4D6`, panel `#F7F4EC`, header band `#1E3A66` with white text, table rules `#9AA7B8`, body text `#1B1B1B`, Book Now `#E8731A` (hover `#C95F0F`), disabled grey `#BDB8AC`, bevel buttons `#D4D0C8` with 2px outset borders.
  - **LED clock:** black `#0A0A0A` panel, digits `#FF3B30`, unlit segments `#2A0A08`. Font `ui-monospace, Menlo, Consolas, monospace`, `font-variant-numeric: tabular-nums`, 56px desktop / 40px mobile.
  - **Booking type:** `Verdana, Tahoma, Geneva, sans-serif`, 13px body, 11px table text, bold header band 15px. No webfonts.
  - **Backend world palette:** bg `#0E1318`, node stroke `#3A4A5A`, node fill `#161E26`, text `#C9D4DF`, pass `#2ECC71`, waiting `#F5A623`, reject `#FF4D4F`, "you" `#FFD400`.
  - **Result stamp:** the one expressive choice. An ink-stamp box rotated −4°, 3px border, uppercase. Green `#1E8E3E` for CNF, red `#C62828` for WL, REGRET and FAILED.
  - **Motion:** the stamp drops in (scale 1.15 → 1, 120 ms). The blame node pulses red twice (2 × 400 ms) and then stays red. Particles replay over 2.5 s. Respect `prefers-reduced-motion` (no pulse, no particles; static counts only).
  - **Layout:** before the click, the booking screen fills the viewport (max 960px, centred). After the click, ≥ 900px shows a 50/50 split (booking left, backend right). Below 900px they stack, result on top. It must work at 390×844.
  - **Copy rules:** first person, plain words, real numbers ("50,000 bots", "128 seats", "1,500 req/s"). No hype verbs, no emoji.
  - **Banned:** gradients, glassmorphism, gradient text, glow shadows, rounded-everything (booking world uses 0–2px radius; backend nodes 4px), marquees, noise overlays, serif display faces, three identical feature cards.

Commit.

### Step 2: Clean the Vue scaffold (15 min)

- Delete scaffold demo files (`src/components/*`, `src/assets/*`, example tests) if `--bare` wasn't available.
- `web/src/main.ts`: `createApp(App).mount('#app')`, import `./styles/tokens.css`, `./styles/retro.css`, `./styles/backend.css`.
- `web/src/App.vue`: a placeholder `<main>` with "Tatkal Trainer".
- `web/package.json` scripts: keep the create-vue scripts (`dev`, `build`, `preview`, `test:unit`, `test:e2e`, `type-check`, `lint`) and add `"sweep": "tsx scripts/sweep.ts"` and `"deploy": "npm run build && wrangler deploy"`.
- `web/playwright.config.ts`: set `use.baseURL` to `process.env.BASE_URL ?? 'http://localhost:5173'` and only define `webServer` when `BASE_URL` is unset (look up the config shape with Context7).
- Run `npm run dev` and `npm run test:unit -- --run` (it may report no tests, which is fine) and `npm run build`. Commit.

### Step 3: Lab scaffold (15 min)

- `lab/requirements.txt`:
  ```
  fastapi>=0.115
  uvicorn[standard]>=0.30
  asyncpg>=0.30
  redis>=5.2
  httpx>=0.27
  pytest>=8.3
  pytest-asyncio>=0.24
  ```
- `cd lab && source .venv/bin/activate && pip install -r requirements.txt`
- `lab/pytest.ini`: `[pytest]` with `asyncio_mode = auto` and `testpaths = tests`.
- `lab/schema.sql`:
  ```sql
  DROP TABLE IF EXISTS bookings; DROP TABLE IF EXISTS seats;
  CREATE TABLE seats (id serial PRIMARY KEY, label text NOT NULL, status text NOT NULL DEFAULT 'free');
  CREATE TABLE bookings (id serial PRIMARY KEY, seat_id int NOT NULL REFERENCES seats(id), passenger text NOT NULL, created_at timestamptz DEFAULT now());
  -- deliberately NO unique constraint on bookings.seat_id: the lab must be able to show double-booking
  ```
- `lab/app/__init__.py`: empty.
- `lab/app/db.py`: `async def reset(conn, seats: int)` runs `schema.sql` and then inserts seats labelled `B1/1..B1/64, B2/1..B2/64` (generic: coach `B{(i//64)+1}/{(i%64)+1}`). Also `async def stats(conn)` returns `{bookings, distinct_seats, double_booked_seats}`, where `double_booked_seats` = the number of seat_ids with more than one booking row.
- Commit.

### Step 4: Simulation core types, RNG and heap, test first (45 min)

These pure files live in `web/src/sim/`. Use relative imports only, so `tsx` can run them from `scripts/`.

- `types.ts`:
  ```ts
  export type FinalStatus = 'CNF' | 'WL' | 'REGRET' | 'FAILED_429' | 'FAILED_QUEUE_FULL' | 'FAILED_TIMEOUT'
  export type Stage = 'lb' | 'bucket' | 'queue' | 'lock'
  export type Blame = 'none' | 'bucket' | 'queue' | 'lock'
  export interface SimConfig {
    bots: number; seats: number; waitlistCap: number
    lbNodes: number; lbMs: number
    rateLimitPerSec: number; burstSeconds: number
    queueSize: number; queueTimeoutMs: number
    workers: number; serviceMs: number
    fastShare: number; fastMeanMs: number; slowMeanMs: number
    botLatencyMinMs: number; botLatencyMaxMs: number; userLatencyMs: number
    maxRetries: number; retryBackoffMs: number; retryJitterMs: number
  }
  export interface UserOutcome { status: FinalStatus; seat?: string; wl?: number; blame: Blame; attempts: number; rateLimitedTimes: number }
  export interface StageSpan { stage: 'network' | Stage; ms: number }
  export interface ParticleTrack { id: number; isUser: boolean; events: { t: number; at: Stage | 'out'; outcome?: FinalStatus }[] }
  export interface RaceTotals { byStatus: Record<FinalStatus, number>; tokensGranted: number; peakQueue: number; seatsGoneAtMs: number | null; waitlistClosedAtMs: number | null }
  export interface RaceResult { seed: number; userDelayMs: number; user: UserOutcome; timeline: StageSpan[]; totals: RaceTotals; tracks: ParticleTrack[]; fcfsScore: number; userRankByClick: number }
  ```
- `defaults.ts`: `DEFAULTS: SimConfig` with these starting values (tuned in step 8): `bots 50_000, seats 128, waitlistCap 600, lbNodes 4, lbMs 2, rateLimitPerSec 1500, burstSeconds 0.25, queueSize 1000, queueTimeoutMs 2500, workers 8, serviceMs 10, fastShare 0.6, fastMeanMs 80, slowMeanMs 1200, botLatencyMinMs 15, botLatencyMaxMs 80, userLatencyMs 90, maxRetries 2, retryBackoffMs 250, retryJitterMs 250`. Also `SLIDERS = { rateLimit: { min: 100, max: 20000 }, queueSize: { min: 10, max: 50000 } }` (both log scale).
- **Red first:** `__tests__/rng.spec.ts`: `mulberry32(42)` produces the same first 5 numbers twice; seeds 42 and 43 differ; every value is in [0,1). `__tests__/heap.spec.ts`: pushing events with times `[5, 1, 3, 1]` pops in time order, and ties pop in insertion order (stable by a sequence number). Run `npm run test:unit -- --run` and see it fail.
- **Green:** `rng.ts` exports `mulberry32(seed): () => number` and `expo(rand, mean)`. `heap.ts` exports `class EventHeap<T>` (binary min-heap on `(t, seq)`) with `push(t, item)`, `pop()` and `size`. Run the tests and see them pass. Commit.

### Step 5: Token bucket (TS), test first (20 min)

- **Red:** `__tests__/tokenBucket.spec.ts`:
  1. `new TokenBucket(5, 0, 0)`: 5 `take(0)` calls return true and the 6th returns false.
  2. `new TokenBucket(5, 10, 0)`: drain 5 at t=0, `take(50)` is false, `take(100)` is true (10 tokens/s = 1 per 100 ms).
  3. After draining, `take(1_000_000)` refills to at most capacity: exactly 5 more succeed.
- **Green:** `tokenBucket.ts` holds `class TokenBucket { constructor(capacity, refillPerSec, nowMs); take(nowMs): boolean; level(): number }`, which refills `min(cap, tokens + (now-ts)*rate/1000)` and then spends 1. **This math must match `lab/app/token_bucket.lua` exactly** (step 9). Commit.

### Step 6: `runRace`, test first (90 min)

- **Red:** `__tests__/race.spec.ts`. Use small explicit configs (spread `DEFAULTS` and override). Set `retryJitterMs: 0` where determinism matters:
  1. **Deterministic:** the same `(cfg, seed, userDelay)` returns deep-equal `user` and `totals` twice.
  2. **Conservation:** with defaults, the sum of `totals.byStatus` equals `bots + 1`.
  3. **Seat invariant:** CNF count ≤ seats, all assigned seat labels are unique, WL numbers given out are exactly `1..k` with k ≤ waitlistCap. (`runRace` exposes this through a test-only `inspect` option that returns the seat and WL assignment arrays. Keep it minimal.)
  4. `bots: 0`: user gets `CNF`, seat `B1/1`, blame `none`.
  5. `bots: 0, seats: 0`: user gets `WL 1`, blame `lock`.
  6. Bucket kill: `bots: 10` (all click before the user), `rateLimitPerSec: 0.001, burstSeconds: 1000` (capacity ≈ 1). The user ends `FAILED_429` with `attempts = 3`, blame `bucket`.
  7. Rate-limited then WL: `bots: 1, seats: 0`, a capacity-1 bucket with `rateLimitPerSec: 10`, user delay 0, bot clicks earlier. The user is rejected once, then gets a token on retry and lands `WL 2`, blame `bucket` (this is the demo scenario's logic).
  8. Queue full: `workers: 1, serviceMs: 10_000, queueSize: 0`, 1 bot earlier. The user gets `FAILED_QUEUE_FULL`, blame `queue`.
  9. Timeout: `workers: 1, serviceMs: 3000, queueTimeoutMs: 1000`, 2 earlier bots. The user gets `FAILED_TIMEOUT`, blame `queue`.
  10. `runRace(cfg, 1, -5)` throws `RangeError`.
  11. `fcfsScore` is in [0,1]. With `bots: 50, seats: 50`, a huge rate limit and queue, and `serviceMs: 1`, it equals 1.
- **Green:** `race.ts` exports `runRace(cfg: SimConfig, seed: number, userDelayMs: number): RaceResult`. The algorithm, which is event-driven, single-threaded and deterministic:
  ```
  if userDelayMs < 0 → throw RangeError('booking not open yet')
  rand = mulberry32(seed); n = bots + 1; id 0 = user
  clickAt[i] (Float64Array): bots: rand()<fastShare ? expo(fastMeanMs) : expo(slowMeanMs); user: userDelayMs
  lat(i): bots uniform(botLatencyMin..Max) drawn once per bot; user = userLatencyMs
  heap.push(clickAt[i] + lat(i) + lbMs, {kind:'ARRIVE', id:i})
  bucket = new TokenBucket(rateLimitPerSec*burstSeconds, rateLimitPerSec, 0)
  queue = ring buffer of {id, enq}; freeWorkers = workers; seatsUsed=0; wl=0
  ARRIVE(id,t): if !bucket.take(t):
                   rl[id]++; if attempts[id] < maxRetries: attempts[id]++;
                     heap.push(t + 2*lat(id) + retryBackoffMs*attempts[id] + rand()*retryJitterMs, ARRIVE id)
                   else final[id]=FAILED_429
                 else if freeWorkers>0: start(id,t,t)
                 else if queue.length >= queueSize: final[id]=FAILED_QUEUE_FULL
                 else queue.push({id,enq:t}); peakQueue=max(...)
  start(id,enq,t): freeWorkers--; heap.push(t+serviceMs, DONE id)
  DONE(id,t): if seatsUsed<seats → CNF seat label(seatsUsed++); seatsGoneAtMs when seatsUsed hits seats
              else if wl<waitlistCap → WL ++wl; waitlistClosedAtMs when wl hits cap
              else REGRET
              freeWorkers++; drain(t)
  drain(t): while freeWorkers>0 && queue nonempty: {id,enq}=shift;
              if t-enq > queueTimeoutMs → final[id]=FAILED_TIMEOUT; continue
              start(id,enq,t)
  ```
  Blame for the user: `CNF` → none; else `rl[0]>0` → bucket; `FAILED_429` → bucket; `FAILED_QUEUE_FULL|FAILED_TIMEOUT` → queue; `WL|REGRET` → lock.
  Timeline for the user (ms): network = 2×latency + lbMs; bucket = time lost from first arrival to the arrival that got a token (0 if none); queue = enq → start; lock = serviceMs (0 if the request never reached it).
  Tracks: after generating arrivals, sample 400 bot ids with `rand` plus id 0, and record `{t, at}` for those ids only (lb, bucket, queue, lock, out + outcome).
  `fcfsScore` = fraction of the first `seats` ids by `clickAt` that ended CNF. `userRankByClick` = 1 + the count of bots with `clickAt < clickAt[0]`.
- Run the tests until they're green. Also log the wall time of one default run (`performance.now()` around `runRace(DEFAULTS, 1, 300)`) once in a scratch test. It must be < 100 ms on this Mac. If it's slower, switch hot arrays to typed arrays and drop per-event object allocation. Record the timing in NOTES.md. Commit.

### Step 7: Formatting, test first (15 min)

- **Red:** `__tests__/format.spec.ts`: `formatClock(-2000)` returns `"09:59:58"`, `formatClock(-1)` returns `"09:59:59"`, `formatClock(0)` and `formatClock(312)` return `"10:00:00"`, `formatOffset(312)` returns `"+0.312 s"`, `formatInt(50001)` returns `"50,001"` (en-IN grouping is not used for 50,001; use en-US so the thread and UI match), `statusLabel({status:'WL', wl:347})` returns `"WL 347"`, `statusLabel({status:'FAILED_429'})` returns `"FAILED: 429 Too Many Requests"`, `FAILED_TIMEOUT` returns `"FAILED: Session timed out"`, `FAILED_QUEUE_FULL` returns `"FAILED: Service unavailable"`, `REGRET` returns `"REGRET"`, and CNF returns `"CNF B2/34"`.
- **Green:** `format.ts`. Clock math: the displayed time is 10:00:00 + offset, and negative offsets use `Math.floor` on seconds. Commit.

### Step 8: Sweep script and tuning: "the math" (45 min)

- `web/scripts/sweep.ts` (run with `npm run sweep -- <args>`):
  - default mode: for user delays `[100, 200, 300, 400, 600, 1000, 2000]` ms × seeds `1..50` at `DEFAULTS`, print a table per delay with the counts of CNF / WL / REGRET / 429 / queue-full / timeout, the median WL, the most common blame, median `seatsGoneAtMs` and median `fcfsScore`.
  - `--find-wl 347`: for seeds `1..2000`, scan user delays 200–500 ms in 1 ms steps, and print the 10 seeds whose contiguous delay window producing exactly `WL 347` with blame `bucket` is widest (seed, window start–end, width).
  - `--fair`: for a grid of rate limit `[200, 500, 800, 1500, 5000, 20000]` × queue size `[10, 100, 1000, 10000, 50000]`, print median `fcfsScore` and the share of all 50,001 requests that ended FAILED (seeds 1..20, user delay 300).
- **Tuning target at DEFAULTS** (change only `fastShare`, `fastMeanMs`, `slowMeanMs`, `retryBackoffMs`, `retryJitterMs`, `waitlistCap`; never the slider ranges):
  - a click at +300 ms: CNF in ≤ 2 of 50 seeds, and ≥ 40% of outcomes are WL with median WL between 150 and 550, mostly blamed on `bucket`;
  - median `seatsGoneAtMs` < 3000 (so "gone by 10:00:03" stays true; if the model disagrees, change the hook's number to what the model shows and record why);
  - `--fair` shows at least one slider setting with median `fcfsScore` ≥ 0.8.
- Paste all three outputs into NOTES.md under "Numbers", along with the final DEFAULTS values. These are the thread's "here is the math". Pick the demo seed from `--find-wl 347` (widest window) and record it as `DEMO_SEED` in NOTES.md. If no window is ≥ 15 ms wide, use the widest one anyway. The demo still shows whatever real number the click produces (see §4). Commit.

### Step 9: Lab token bucket in Redis, test first (30 min)

- **Red:** `lab/tests/test_bucket.py` (fixture: `redis.asyncio.from_url("redis://localhost:6379/15")`, `flushdb` before each test):
  1. capacity 5, rate 0, `now_ms=0`: 5 allowed, the 6th rejected.
  2. capacity 5, rate 10/s: drain at 0, rejected at 50 ms, allowed at 100 ms.
  3. Atomic under concurrency: capacity 50, rate 0, `asyncio.gather` of 200 `take()` calls: exactly 50 allowed.
- **Green:** `lab/app/token_bucket.lua`:
  ```lua
  -- KEYS[1]=bucket key; ARGV: capacity, refill_per_sec, now_ms
  local cap = tonumber(ARGV[1]); local rate = tonumber(ARGV[2]); local now = tonumber(ARGV[3])
  local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
  local tokens = tonumber(b[1]) or cap
  local ts = tonumber(b[2]) or now
  tokens = math.min(cap, tokens + (now - ts) * rate / 1000)
  local allowed = 0
  if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
  redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
  redis.call('PEXPIRE', KEYS[1], 60000)
  return allowed
  ```
  `lab/app/bucket.py`: `class RedisTokenBucket(redis, key, capacity, refill_per_sec)` loads the script once with `register_script` (check redis-py asyncio docs via Context7) and exposes `async take(now_ms: int | None = None) -> bool` (defaults to `time.monotonic_ns()//1_000_000` when not given). Passing `now_ms` in is what makes the tests deterministic.
- `cd lab && pytest -q tests/test_bucket.py` until green. Commit.

### Step 10: Lab seat lock: reproduce the double-booking, then fix it (60 min)

This step is the thread's story, so do it in this exact order.

- `lab/tests/conftest.py`: an asyncpg pool fixture (`min_size=50, max_size=50`, DSN `postgresql://localhost/tatkal_test`, or the `TEST_DATABASE_URL` env var if set). Each test calls `db.reset(conn, seats=50)`.
- `lab/tests/test_seats.py`: one invariant test, `test_no_seat_sold_twice(strategy)`. It runs 200 concurrent bookers (`asyncio.gather`, each acquires its own connection and calls `book(conn, strategy, f"p{i}")`) against 50 seats, then asserts:
  - `stats.double_booked_seats == 0`
  - `stats.bookings == stats.distinct_seats == 50` (demand > supply, so every seat must sell exactly once)
  - the number of `CNF` returns == 50, and the rest return `REGRET`.
- **First, write only the naive strategy** in `lab/app/seats.py`. This is the version I actually wrote first:
  ```python
  async def book_naive(conn, passenger):
      async with conn.transaction():
          row = await conn.fetchrow("SELECT id, label FROM seats WHERE status='free' ORDER BY id LIMIT 1")
          if row is None: return {"status": "REGRET"}
          await fare_check()        # asyncio.sleep(0.005): stands in for fare/quota checks between read and write
          await conn.execute("UPDATE seats SET status='booked' WHERE id=$1", row["id"])
          await conn.execute("INSERT INTO bookings(seat_id, passenger) VALUES ($1, $2)", row["id"], passenger)
          return {"status": "CNF", "seat": row["label"]}
  ```
  Parametrize the test with `naive` only and run `pytest -q tests/test_seats.py`. **It must fail (red) with double-booked seats.** Copy the exact failure numbers (bookings, distinct seats, double-booked seats) into NOTES.md under "What failed". This is the thread's "my first seat-lock double-booked seats". Be honest in NOTES that the 5 ms `fare_check` widens the race window so it reproduces every run.
- **Fix:** add `book_skip_locked`, which is the same transaction but with `SELECT id, label FROM seats WHERE status='free' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED` (confirm the semantics in the Postgres docs via Context7). Add `skip_locked` to the parametrize and run: it passes (green).
- Add `book_for_update` (plain `FOR UPDATE`, no SKIP LOCKED) as a comparison and parametrize it too. Whether it passes or fails, record the real result and its wall time in NOTES.md. Don't predict it.
- Final parametrize: `pytest.param("naive", marks=pytest.mark.xfail(strict=True, reason="reproduces the double-booking bug"))`, `"for_update"` (if it fails the invariant, mark it xfail strict with the observed reason), `"skip_locked"`.
- `book(conn, strategy, passenger)` dispatches on the strategy name.
- `pytest -q` must show all passing plus the expected xfails. Commit.

### Step 11: FastAPI lab app and load test (45 min)

- `lab/app/main.py`: the FastAPI app with a lifespan that creates the asyncpg pool (`DATABASE_URL`, default `postgresql://localhost/tatkal_lab`, pool size 50) and redis (`REDIS_URL`, default `redis://localhost:6379/0`). Endpoints:
  - `POST /reset?seats=128`: `db.reset`, and deletes the bucket key.
  - `POST /book?strategy=skip_locked&limit=on` with body `{"passenger": str}`. If `limit=on` and `RedisTokenBucket(capacity=375, refill_per_sec=1500).take()` is false, return 429 `{"status":"FAILED_429"}`. Otherwise call `book(...)` and return 200 with the result.
  - `GET /stats`: `db.stats`.
- `lab/load.py`: an argparse script taking `--strategy`, `--requests 2000`, `--concurrency 200`, `--limit on|off` and `--base http://localhost:8000`. It POSTs `/reset`, fires requests with `httpx.AsyncClient` and an `asyncio.Semaphore`, then GETs `/stats`, and prints a table: CNF, REGRET, 429, double-booked seats, p50 / p99 latency ms, total wall ms.
- Run it in two terminals:
  ```bash
  cd lab && source .venv/bin/activate && uvicorn app.main:app --port 8000
  # other terminal
  cd lab && source .venv/bin/activate
  python load.py --strategy naive --limit off
  python load.py --strategy for_update --limit off
  python load.py --strategy skip_locked --limit off
  python load.py --strategy skip_locked --limit on
  ```
- Paste all four tables into NOTES.md under "Numbers / lab". Commit.

### Step 12: UI direction (15 min)

- Invoke the **`frontend-design`** skill by name for the product UI work in steps 13–19. Tell it that `DESIGN.md` is the source of truth and wins over the skill's defaults.
- From here on, every UI step ends with a **visual check**: run `npm run dev`, take Playwright screenshots at 1280×800 and 390×844 (use the `e2e/screens.spec.ts` from step 20 as soon as it exists; before then use a quick Playwright `page.screenshot` script or the browser), look at them, fix, and repeat until it matches DESIGN.md.

### Step 13: Booking screen and LED clock (60 min)

- `composables/useUrlParams.ts` reads `?seed=` (int; default random 1..999,999) and `?start=` (seconds before open; default 5, clamp 1–30). It returns refs, plus `buildShareUrl(seed)`.
- `composables/useCountdown.ts(startSecondsBefore)`: `openAt = performance.now() + start*1000`. A `requestAnimationFrame` loop exposes `offsetMs` (negative before open), `isOpen`, `restart(startSeconds)` and `stop()`.
- `components/LedClock.vue`: shows `formatClock(offsetMs)` in the LED panel. After open it also shows a small `formatOffset` line underneath. The panel label reads "Tatkal opens 10:00:00".
- `components/BookingScreen.vue` (booking world):
  - A header band reading "TATKAL TRAINER · practice booking".
  - A step bar: `1 Journey › 2 Passengers › 3 Payment`, with step 2 active.
  - A journey table: Train `22999 VIDARBHA PRACTICE EXP`, From `NGP Nagpur` → To `CSMT Mumbai`, Date = tomorrow (computed, `DD-MM-YYYY`), Class `3A`, Quota `TATKAL`, Fare `₹1,845`.
  - A passenger table with one prefilled row: `YOU | 29 | M | Lower (it won't matter)`.
  - `LedClock` at top right on desktop, above the form on mobile.
  - A line counting "bots connected: 50,000" during the countdown (it ticks up from 0 to 50,000 over the countdown; this is display only).
  - The **Book Now** button: grey and `aria-disabled` before open, orange from open. `pointerdown` (and Enter/Space) emits `book` with `offsetMs` taken at that event. Before open, a press shakes the button (skip the shake under reduced motion) and shows "Booking opens at 10:00:00" without locking anything.
  - A footer: "Toy model I wrote. Not IRCTC's real architecture. Not affiliated with IRCTC or Indian Railways."
- `styles/tokens.css` holds the DESIGN.md colours as CSS variables. `styles/retro.css` holds the bevel buttons, table rules and header band.
- Visual check. Commit.

### Step 14: App state machine, waiting bar, ticket result (60 min)

- `App.vue` phases: `countdown → waiting → result`.
  - On `book(offsetMs)`: compute `result = runRace(cfg, seed, offsetMs)` at once (store `userDelayMs`), show `WaitingBar` for **400 ms**, then switch to `result`.
  - Layout: `result` adds the split class (50/50 ≥ 900px, stacked below).
  - The "Try again" button calls `restart(5)` with a fresh random seed, and keeps the sliders' values.
  - "Same race again" restarts with the same seed.
- `components/WaitingBar.vue`: "Please wait… processing your request" with a retro block progress bar (it fills over 400 ms).
- `components/TicketResult.vue`:
  - The ink stamp shows `statusLabel(user)`.
  - Lines below it:
    - "You clicked at `+0.312 s` · request #`31,204` of `50,001` by click time"
    - "All `128` seats gone at `10:00:00.4xx`" (from `seatsGoneAtMs`; if null: "Seats never ran out")
    - "Race #`seed`"
  - Buttons: Try again, Same race again, and Share (step 19).
- `composables/usePracticeLog.ts`: in localStorage key `tatkal-trainer:v1`, keep `{ attempts, best }`, where best ranks CNF > lowest WL > REGRET > FAILED. Show "Attempts: 9 · Best: WL 112" under the stamp.
- Visual check at both sizes. Commit.

### Step 15: Pipeline view, blame highlight, your timeline (75 min)

- `components/PipelineView.vue` (backend world) is an SVG with `viewBox="0 0 800 380"` laid out left to right:
  1. **Clients**: "50,001 requests".
  2. **Load balancer**: 4 small node boxes, "app-1…app-4".
  3. **Token bucket (Redis)**: a vertical gauge with the label `1,500 req/s · burst 375`, plus the count of `429`s.
  4. **Queue**: a horizontal slot bar with the label `1,000 slots · 2.5 s timeout`, plus peak fill, the queue-full count and the timed-out count.
  5. **Workers**: 8 squares.
  6. **Seat lock (Postgres)**: a 2×64 mini grid of seat cells (filled = sold) with the label `SELECT … FOR UPDATE SKIP LOCKED`.
  7. **Outcomes column**: CNF / WL / REGRET / 429 / Queue full / Timed out counts with tabular numbers.
- The heading reads "What happened to your request" with the subline "Race #seed · toy model, not IRCTC's design".
- **Blame:** the blamed node's stroke and fill turn reject red **the instant the result view mounts**, before any animation, so the demo shot works. It pulses twice, then stays red. Your path's edges are drawn in "you" yellow up to the blamed node. CNF lights the whole path green.
- One plain-language line under the diagram, chosen by blame:
  - bucket: "The token bucket said no `{n}` time(s). By the time your retry got a token, `{k}` people were ahead of you."
  - queue: "You got past the rate limit, then waited in the queue past the 2.5 s timeout." (or "…the queue was full.")
  - lock: "You reached the seat lock in time, but all 128 seats were already locked by earlier requests."
  - none: "You got a seat. Screenshot it, it won't happen again."
- `components/YourTimeline.vue`: one horizontal segmented bar of your request's ms by stage (network / bucket / queue / lock), each segment labelled in ms, with the total "your request took 1,234 ms (simulated)".
- Visual check. Commit.

### Step 16: Particle replay (45 min)

- `components/ParticleLayer.vue`: a `<canvas>` absolutely positioned over the SVG (same aspect, DPR-aware). It replays `result.tracks` over **2.5 s** (sim time 0 → max track time, mapped linearly). Dots move node to node and take the colour of their outcome when they exit: green CNF, amber WL, red failures. The user's dot is yellow and twice the size, with a "YOU" label.
- Start the replay 300 ms after the result mounts. It never delays the blame highlight. Under `prefers-reduced-motion` it doesn't render.
- There's a "Replay" text button.
- Visual check (screenshot mid-replay). Commit.

### Step 17: Sliders: "try to make it fair" (45 min)

- `components/ControlSliders.vue`: two `<input type="range">` on a log scale. Rate limit is 100–20,000 req/s and shows `1,500 req/s`. Queue size is 10–50,000 and shows `1,000 slots`. Each has a "Reset to default" link.
- On change (debounced 150 ms), re-run `runRace(cfgWithSliders, sameSeed, sameUserDelayMs)` and update the pipeline, timeline and outcome counts. The ticket stamp keeps the original result and adds the line "With these settings you'd have got: `WL 88`" (or "the same result").
- Show `FCFS score: 31% of the first 128 clickers got a seat` and `Requests that failed outright: 41,210`.
- The pipeline labels update with the slider values.
- Visual check. Commit.

### Step 18: Stage explainer drawer (30 min)

- `components/StageDrawer.vue`: clicking or tapping a pipeline node (keyboard focusable, Enter opens it) opens a panel under the diagram on desktop and a bottom sheet on mobile. Content is plain, two sentences plus a snippet:
  - Load balancer: "Spreads requests across 4 app servers. It doesn't decide who wins."
  - Token bucket: "Each request costs one token; tokens refill at the rate limit. Retries compete with fresh clicks for the same tokens." Snippet: the Lua from step 9.
  - Queue: "First in, first out, up to N slots. Wait longer than 2.5 s and the server drops you."
  - Seat lock: "My first version read a free seat, then updated it 5 ms later. Two requests read the same seat and both got it. The fix: `SELECT … FOR UPDATE SKIP LOCKED`, so each request locks a different free seat." Snippet: the SQL from step 10 plus the real double-booking count from NOTES.md.
- Visual check. Commit.

### Step 19: Share, meta, favicon (30 min)

- `components/ShareButton.vue`: the text is `I got {statusLabel} on Tatkal Trainer. The {blame stage name} rejected me. Same race: {buildShareUrl(seed)}`. It uses `navigator.share` when available, otherwise the clipboard, and shows "Copied" for 1.5 s.
- `web/index.html`: title "Tatkal Trainer: practise losing at 10:00:00", the description is the hook sentence, `og:image` = `/og.png` (made absolute after deploy, §5), and `twitter:card` = `summary_large_image`.
- `web/public/favicon.svg`: a simple red LED "10" on black.
- Visual check. Commit.

### Step 20: E2E tests and screenshots (45 min)

- `web/e2e/race.spec.ts`:
  1. Open `/?seed=42&start=1`. The Book button is `aria-disabled`, and the clock reads `09:59:59`.
  2. Wait for the clock to show `10:00:00`, then click Book.
  3. Within 1 s, the stamp matches `/^(CNF B\d\/\d+|WL \d+|REGRET|FAILED: .+)$/`, the pipeline SVG is visible, and exactly one node has the blame class (or none if CNF).
  4. Move the rate-limit slider and expect the "With these settings" line to appear.
  5. Expect no console errors (collect `page.on('console')` errors and assert the list is empty).
- `web/e2e/screens.spec.ts`: for viewports 1280×800 and 390×844, save `web/screens/{size}-{1-countdown,2-open,3-waiting,4-result,5-drawer,6-sliders}.png`. Also save a 1200×630 crop of the 1280 result view to `web/public/og.png`.
- `npm run test:e2e`. Open every screenshot and fix anything off-DESIGN (overflow at 390px, clipped labels, unreadable numbers). Repeat. Commit.

---

## 4. Demo recording (15–30 s, 16:9)

1. Use the live URL from §5 (or `npm run preview` if you're recording before deploy) with `?seed=<DEMO_SEED>&start=3`. `DEMO_SEED` and its WL-347 delay window are in NOTES.md (step 8).
2. Use a Chrome window sized so the viewport is 1280×720. Zoom 100%, bookmarks bar hidden, no extensions visible, macOS Do Not Disturb on.
3. Practise a few times. The window from `--find-wl 347` tells you how many ms after 10:00:00 to click (about +0.3 s).
4. Record with the macOS Screenshot toolbar (`⇧⌘5` → Record Selected Portion → select the viewport). Start recording, then reload the page.
5. Script:
   - **0.0–2.0 s:** the clock ticks `09:59:58 → 10:00:00` (trim the reload so the first frame shows 09:59:58).
   - **~2.3 s:** click Book. The 400 ms wait bar runs, and the screen splits: the stamp reads `WL 347` and the token bucket is red.
   - **3–8 s:** the particles replay, and the YOU dot dies at the bucket and retries.
   - **8–16 s:** drag the rate limit down and the queue size up. "With these settings you'd have got: …" changes.
   - **16–22 s:** tap the Seat lock node, and the SKIP LOCKED snippet and the double-booking line appear.
   - **22–26 s:** click Share and "Copied" shows. End.
6. **The number on screen must be real.** Take as many takes as you need to land `WL 347`. If you can't land it after about 15 takes, use the best real take (any WL with the bucket red), write the real number in NOTES.md and use it in the post copy. Never edit the number in post. The shared link includes the seed, so anyone can replay the same race.
7. Trim and export with the **`video-use`** skill: cut the head so frame 1 shows `09:59:58`, keep it at 15–30 s, use H.264 MP4, 30 fps, no music, and add no captions in this pass. Save to `recordings/demo.mp4` (gitignored).

---

## 5. Deploy: a free, static live link on Cloudflare Workers (static assets)

Everything the reader plays runs in the browser, so a static deploy is the whole product. Cloudflare follows the creator's rules, and since a Wrangler config exists, use Wrangler. Check the assets-only config shape with Context7 (Wrangler docs) before running.

- `web/wrangler.jsonc`:
  ```jsonc
  {
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "tatkal-trainer",
    "compatibility_date": "2026-11-23",
    "assets": { "directory": "./dist" }
  }
  ```
- Commands:
  ```bash
  cd web
  npx wrangler login            # browser OAuth, one time
  npm run deploy                # = npm run build && wrangler deploy
  ```
- Wrangler prints `https://tatkal-trainer.<account-subdomain>.workers.dev`. Then:
  1. In `index.html`, set `og:url` to it and set `og:image` / `twitter:image` to `<url>/og.png`. Run `npm run deploy` again.
  2. Put the URL in the README "Live:" line and in NOTES.md.
- GitHub (public, so the thread can link the lab code). First check that `git status` shows no `.env` or secrets:
  ```bash
  cd ..   # project root
  gh repo create tatkal-trainer --public --source=. --remote=origin --push
  ```
- The FastAPI lab is **not** deployed. It's local proof for the thread.

---

## 6. Verification (do all of it before calling it done)

1. `cd web && npm run test:unit -- --run`: all sim tests green. Paste the summary line into NOTES.md.
2. `npm run type-check && npm run lint && npm run build`: no errors.
3. `npm run test:e2e`: green against the dev server.
4. `BASE_URL=https://tatkal-trainer.<sub>.workers.dev npx playwright test e2e/race.spec.ts`: green against the **live** URL.
5. `cd lab && source .venv/bin/activate && pytest -q`: bucket tests pass, `skip_locked` passes, `naive` shows as **xfailed** (strict). Paste the summary line.
6. `python load.py …` for all four runs (step 11): tables are in NOTES.md, `skip_locked` shows 0 double-booked seats, `naive` shows > 0.
7. Open every screenshot in `web/screens/` (both sizes, all 6 views) and look at each one. Fix and re-shoot until none is off-DESIGN.
8. Open the live URL by hand on desktop Chrome and on a real phone. Play one full race on each, and test the share link round trip (opening a shared link replays the same seed).
9. Run `npm run sweep` once more against the final DEFAULTS. The numbers in NOTES.md must match what's shipped.
10. Self-check the copy against the slop rules in DESIGN.md: every visible line names something real (seats, req/s, ms, request numbers).

Only report "done" when 1–9 pass. If anything fails, report it with the output.

---

## 7. Launch notes: keep `NOTES.md` running as you build

Create it in step 1 with this skeleton and add to it at every step that produces a number or a failure:

```markdown
# NOTES: Tatkal Trainer (System Design, Visualized #1)

Model credit: Built with Claude Opus 5.5
Live: <url>
Repo: <url>
DEMO_SEED: <seed> (WL 347 window: +___ to +___ ms)

## What failed (prompt or model → what broke → fix that worked)
| When | Prompt / model | What broke | Fix that worked |
|------|----------------|------------|-----------------|
| step 10 | naive seat booking (read, 5 ms fare check, update) | N bookings for 50 seats, K seats sold twice | SELECT … FOR UPDATE SKIP LOCKED |

## Numbers
### Sim (npm run sweep): delay table, --fair grid, final DEFAULTS
### Lab (load.py): naive / for_update / skip_locked / skip_locked+limit
### Perf: runRace default wall time

## Thread draft inputs
```

**Rules for NOTES.md:**
- Every time a prompt to the coding model produces something wrong (a sim bug, a flaky test, a broken layout, a wrong API from memory that Context7 corrected), log the prompt or model, what broke, and the fix that worked.
- Record real numbers only.

**The thread (written later from NOTES.md, in the reference's shape: deadpan claim, then "here is the math"):**
1. The hook, verbatim, plus the demo video.
2. The math: "50,000 bots, 128 seats, a bucket that lets 1,500 req/s through. If you click at +0.3 s, you won `X` of 50 races." (from the sweep table)
3. Where you die: the bucket vs queue vs lock split (from the sweep), and why retries turn a rate limit into a lottery.
4. What failed: "my first seat lock double-booked `K` of 50 seats" (real lab numbers), then the fix, `SELECT … FOR UPDATE SKIP LOCKED`, and the `for_update` comparison numbers.
5. Make it fair: the `--fair` grid result and the slider setting that gets FCFS ≥ 0.8, plus what it costs (how many requests fail outright).
6. Live link, plus "toy model, not IRCTC's design".
7. The credit line: "Built with Claude Opus 5.5".

Voice: first person, plain words, real numbers, no hype verbs, no emoji.

---

## 8. Out of scope (keeps this to one weekend)

- Any real IRCTC integration, scraping, login, captcha, OTP, Aadhaar or payment flow.
- Deploying the FastAPI/Redis/Postgres lab online, and any use of AWS.
- Accounts, a global leaderboard, multiplayer or live races, analytics, a backend for shares.
- More sliders than rate limit and queue size (seats, workers, bots and retries stay fixed in the UI).
- A waitlist in the lab (the lab only does CNF / REGRET / 429).
- Sound, Three.js/3D, the fal/blender asset pipeline, webfonts, a Hindi/i18n version.
- Vue Router, Pinia, a component library.
- A vertical/mobile cut of the video, captions, a motion-film launch clip.
- Writing and posting the thread itself (it gets written from NOTES.md after launch).

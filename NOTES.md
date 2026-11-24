# NOTES: Tatkal Trainer (System Design, Visualized #1)

Model credit: Built with Claude Opus 5.5
Live: <url>
Repo: <url>
DEMO_SEED: <seed> (WL 347 window: +___ to +___ ms)

## What failed (prompt or model → what broke → fix that worked)
| When | Prompt / model | What broke | Fix that worked |
|------|----------------|------------|-----------------|
| step 10 | naive seat booking (read, 5 ms fare check, update) | pending | SELECT … FOR UPDATE SKIP LOCKED |

## Numbers
### Sim (npm run sweep): delay table, --fair grid, final DEFAULTS

(pending step 8)

### Lab (load.py): naive / for_update / skip_locked / skip_locked+limit

(pending step 11)

### Perf: runRace default wall time

- `runRace(DEFAULTS, 1, 300)` on Apple Silicon Mac (Node v26.13.1 via tsx): **35.13 ms** cold, **35.88 ms** warm (target: < 100 ms).

### Verification summaries

(pending step 20 / §6)

## Thread draft inputs

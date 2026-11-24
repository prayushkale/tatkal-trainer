<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { formatInt } from '../sim/format.ts'
import type { Stage } from '../sim/types.ts'

const props = defineProps<{
  stage: Stage | null
  queueSize: number
  rateLimitPerSec: number
}>()

const emit = defineEmits<{
  close: []
}>()

const LUA_SNIPPET = `-- lab/app/token_bucket.lua (atomic in Redis)
local cap = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + math.max(0, now - ts) * rate / 1000)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
return allowed`

const SQL_SNIPPET = `-- Naive (200 concurrent bookers vs 50 seats ->
-- 200 bookings on 7 seats, 7 double-booked):
SELECT id, label FROM seats
WHERE status='free' ORDER BY id LIMIT 1;

-- Fix (50 bookings on 50 seats, 0 double-booked, 26.8 ms):
SELECT id, label FROM seats
WHERE status='free'
ORDER BY id LIMIT 1
FOR UPDATE SKIP LOCKED;`

const content = computed(() => {
  switch (props.stage) {
    case 'lb':
      return {
        title: 'Load balancer (app-1 to app-4)',
        body: "Spreads requests across 4 app servers. It doesn't decide who wins.",
        snippet: '',
        note: 'Adds 2 ms routing overhead in this toy model before requests hit the shared Redis rate limiter.',
      }
    case 'bucket':
      return {
        title: `Token bucket (Redis · ${formatInt(props.rateLimitPerSec)} req/s)`,
        body: 'Each request costs one token; tokens refill at the rate limit. Retries compete with fresh clicks for the same tokens.',
        snippet: LUA_SNIPPET,
        note: 'Ran 200 concurrent Redis calls against capacity 50 in lab/tests/test_bucket.py: 50 allowed, 150 rejected.',
      }
    case 'queue':
      return {
        title: `Request queue (${formatInt(props.queueSize)} slots)`,
        body: `First in, first out, up to ${formatInt(props.queueSize)} slots. Wait longer than 2.5 s and the server drops you.`,
        snippet: '',
        note: 'With 8 workers at 10 ms per seat lock (800 req/s), any rate limit above 800 req/s fills the queue until slots run out or requests time out.',
      }
    case 'lock':
      return {
        title: 'Seat lock (Postgres · FOR UPDATE SKIP LOCKED)',
        body: 'My first version read a free seat, then updated it 5 ms later. Two requests read the same seat and both got it. The fix: SELECT … FOR UPDATE SKIP LOCKED, so each request locks a different free seat.',
        snippet: SQL_SNIPPET,
        note: 'Local Postgres load test (2,000 HTTP requests vs 128 seats): naive double-booked 101 seats (352 bookings); plain FOR UPDATE had 0 double-bookings at 5,255 ms p99; SKIP LOCKED had 0 double-bookings at 2,793 ms p99.',
      }
    default:
      return null
  }
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.stage !== null) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <aside
    v-if="content"
    class="stage-drawer"
    role="region"
    :aria-label="content.title"
    data-testid="stage-drawer"
  >
    <div class="drawer-head">
      <h3 class="drawer-title">{{ content.title }}</h3>
      <button
        type="button"
        class="close-btn ops-mono"
        aria-label="Close stage details"
        data-testid="drawer-close"
        @click="emit('close')"
      >
        Close
      </button>
    </div>

    <p class="drawer-body">{{ content.body }}</p>
    <pre v-if="content.snippet" class="drawer-code ops-mono"><code>{{ content.snippet }}</code></pre>
    <p class="drawer-note ops-mono">{{ content.note }}</p>
  </aside>
</template>

<style scoped>
.stage-drawer {
  background: #161E26;
  border: 1px solid var(--ops-you);
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.drawer-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--ops-you);
}

.close-btn {
  background: #0E1318;
  color: var(--ops-text);
  border: 1px solid var(--ops-node-stroke);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
}

.close-btn:hover {
  border-color: var(--ops-text);
}

.drawer-body {
  margin: 0;
  font-size: 12px;
  color: var(--ops-text);
  line-height: 1.5;
}

.drawer-code {
  margin: 0;
  padding: 8px 10px;
  background: #0B1014;
  border: 1px solid #2A3846;
  border-radius: 2px;
  font-size: 11px;
  color: #D7E3EF;
  overflow-x: auto;
  line-height: 1.45;
}

.drawer-note {
  margin: 0;
  font-size: 11px;
  color: var(--ops-muted);
}

@media (max-width: 899px) {
  .stage-drawer {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 40;
    max-height: 70vh;
    overflow-y: auto;
    border-width: 2px;
  }
}
</style>

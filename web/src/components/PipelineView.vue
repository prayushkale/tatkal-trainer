<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatInt } from '../sim/format.ts'
import type { RaceResult, SimConfig, Stage } from '../sim/types.ts'
import ParticleLayer from './ParticleLayer.vue'

const props = defineProps<{
  result: RaceResult
  cfg: SimConfig
  selectedStage: Stage | null
}>()

const emit = defineEmits<{
  selectStage: [stage: Stage]
}>()

const replayKey = ref(0)

const blame = computed(() => props.result.user.blame)
const burstCapacity = computed(() => Math.round(props.cfg.rateLimitPerSec * props.cfg.burstSeconds))

const queueFillRatio = computed(() => {
  if (props.cfg.queueSize <= 0) return 1
  return Math.min(1, props.result.totals.peakQueue / props.cfg.queueSize)
})

const seatsSold = computed(() => Math.min(props.cfg.seats, props.result.totals.byStatus.CNF))

const blameExplanation = computed(() => {
  const u = props.result.user
  if (u.blame === 'none') {
    return "You got a seat. Screenshot it, it won't happen again."
  }
  if (u.blame === 'bucket') {
    const n = u.rateLimitedTimes
    const timesWord = n === 1 ? '1 time' : `${n} times`
    if (u.status === 'FAILED_429') {
      return `The token bucket said no ${timesWord}. All ${u.attempts} attempts were rejected before a token opened up.`
    }
    const ahead =
      u.status === 'WL' && u.wl !== undefined
        ? props.cfg.seats + u.wl - 1
        : props.cfg.seats + props.cfg.waitlistCap
    return `The token bucket said no ${timesWord}. By the time your retry got a token, ${formatInt(ahead)} people were ahead of you.`
  }
  if (u.blame === 'queue') {
    if (u.status === 'FAILED_TIMEOUT') {
      return `You got past the rate limit, then waited in the queue past the ${(props.cfg.queueTimeoutMs / 1000).toFixed(1)} s timeout.`
    }
    return 'You got past the rate limit, then the queue was full.'
  }
  return `You reached the seat lock in time, but all ${formatInt(props.cfg.seats)} seats were already locked by earlier requests.`
})

const edgeColor = computed(() => (blame.value === 'none' ? '#2ECC71' : '#FFD400'))

function edgeActive(edgeIdx: number): boolean {
  // Edges: 0 Clients->LB, 1 LB->Bucket, 2 Bucket->Queue, 3 Queue->Workers, 4 Workers->Lock, 5 Lock->Out
  if (blame.value === 'none') return true
  if (blame.value === 'bucket') {
    if (props.result.user.status === 'FAILED_429') return edgeIdx <= 1
    return edgeIdx <= 4
  }
  if (blame.value === 'queue') return edgeIdx <= 2
  return edgeIdx <= 4
}

function handleNodeKey(e: KeyboardEvent, stage: Stage) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('selectStage', stage)
  }
}

function triggerReplay() {
  replayKey.value++
}
</script>

<template>
  <div class="pipeline-wrap">
    <div class="pipeline-head">
      <div>
        <h2 class="pipeline-title">What happened to your request</h2>
        <div class="pipeline-sub ops-mono">
          Race #{{ result.seed }} · toy model, not IRCTC's design
        </div>
      </div>
      <button
        type="button"
        class="replay-btn ops-mono"
        data-testid="replay-btn"
        @click="triggerReplay"
      >
        Replay
      </button>
    </div>

    <div class="diagram-stage">
      <svg
        viewBox="0 0 800 380"
        class="pipeline-svg"
        role="img"
        aria-label="Toy backend pipeline diagram showing load balancer, Redis token bucket, queue, workers, Postgres seat lock, and outcomes"
        data-testid="pipeline-svg"
      >
        <rect x="0" y="0" width="800" height="380" fill="#0E1318" />

        <!-- Connecting edges -->
        <g class="edges" stroke-linecap="square">
          <line
            x1="102" y1="180" x2="124" y2="180"
            :stroke="edgeActive(0) ? edgeColor : '#3A4A5A'"
            :stroke-width="edgeActive(0) ? 2.5 : 1.5"
          />
          <line
            x1="216" y1="180" x2="240" y2="180"
            :stroke="edgeActive(1) ? edgeColor : '#3A4A5A'"
            :stroke-width="edgeActive(1) ? 2.5 : 1.5"
          />
          <line
            x1="346" y1="180" x2="370" y2="180"
            :stroke="edgeActive(2) ? edgeColor : '#3A4A5A'"
            :stroke-width="edgeActive(2) ? 2.5 : 1.5"
          />
          <line
            x1="476" y1="180" x2="500" y2="180"
            :stroke="edgeActive(3) ? edgeColor : '#3A4A5A'"
            :stroke-width="edgeActive(3) ? 2.5 : 1.5"
          />
          <line
            x1="570" y1="180" x2="592" y2="180"
            :stroke="edgeActive(4) ? edgeColor : '#3A4A5A'"
            :stroke-width="edgeActive(4) ? 2.5 : 1.5"
          />
          <line
            x1="694" y1="180" x2="712" y2="180"
            :stroke="edgeActive(5) ? edgeColor : '#3A4A5A'"
            :stroke-width="edgeActive(5) ? 2.5 : 1.5"
          />
        </g>

        <!-- 1. Clients -->
        <g class="node-static">
          <rect x="14" y="130" width="88" height="100" rx="4" fill="#161E26" stroke="#3A4A5A" stroke-width="1.5" />
          <text x="58" y="154" text-anchor="middle" class="svg-title">Clients</text>
          <text x="58" y="182" text-anchor="middle" class="svg-num">{{ formatInt(cfg.bots + 1) }}</text>
          <text x="58" y="198" text-anchor="middle" class="svg-sub">requests</text>
        </g>

        <!-- 2. Load balancer -->
        <g
          class="pipeline-node clickable"
          :class="{ 'is-selected': selectedStage === 'lb' }"
          tabindex="0"
          role="button"
          aria-label="Load balancer stage details"
          data-stage="lb"
          @click="emit('selectStage', 'lb')"
          @keydown="handleNodeKey($event, 'lb')"
        >
          <rect x="124" y="114" width="92" height="132" rx="4" class="node-box" />
          <text x="170" y="134" text-anchor="middle" class="svg-title">Load balancer</text>
          <g v-for="idx in 4" :key="idx">
            <rect
              x="136"
              :y="144 + (idx - 1) * 23"
              width="68"
              height="17"
              rx="2"
              fill="#0E1318"
              stroke="#3A4A5A"
              stroke-width="1"
            />
            <text x="170" :y="156 + (idx - 1) * 23" text-anchor="middle" class="svg-mono-sm">
              app-{{ idx }}
            </text>
          </g>
        </g>

        <!-- 3. Token bucket (Redis) -->
        <g
          class="pipeline-node clickable"
          :class="{
            'is-blamed': blame === 'bucket',
            'is-selected': selectedStage === 'bucket',
          }"
          tabindex="0"
          role="button"
          aria-label="Token bucket Redis stage details"
          data-stage="bucket"
          @click="emit('selectStage', 'bucket')"
          @keydown="handleNodeKey($event, 'bucket')"
        >
          <rect x="240" y="84" width="106" height="192" rx="4" class="node-box" />
          <text x="293" y="104" text-anchor="middle" class="svg-title">Token bucket</text>
          <text x="293" y="118" text-anchor="middle" class="svg-sub">Redis Lua</text>

          <!-- Vertical gauge -->
          <rect x="279" y="128" width="28" height="72" rx="2" fill="#0E1318" stroke="#3A4A5A" stroke-width="1" />
          <rect
            x="281"
            :y="result.totals.byStatus.FAILED_429 > 0 ? 190 : 146"
            width="24"
            :height="result.totals.byStatus.FAILED_429 > 0 ? 8 : 52"
            :fill="blame === 'bucket' ? '#FF4D4F' : '#2ECC71'"
          />

          <text x="293" y="218" text-anchor="middle" class="svg-mono-sm">
            {{ formatInt(cfg.rateLimitPerSec) }} req/s
          </text>
          <text x="293" y="233" text-anchor="middle" class="svg-sub">
            burst {{ formatInt(burstCapacity) }}
          </text>
          <text x="293" y="256" text-anchor="middle" class="svg-reject">
            429: {{ formatInt(result.totals.byStatus.FAILED_429) }}
          </text>
        </g>

        <!-- 4. Queue -->
        <g
          class="pipeline-node clickable"
          :class="{
            'is-blamed': blame === 'queue',
            'is-selected': selectedStage === 'queue',
          }"
          tabindex="0"
          role="button"
          aria-label="Queue stage details"
          data-stage="queue"
          @click="emit('selectStage', 'queue')"
          @keydown="handleNodeKey($event, 'queue')"
        >
          <rect x="370" y="84" width="106" height="192" rx="4" class="node-box" />
          <text x="423" y="104" text-anchor="middle" class="svg-title">Queue</text>
          <text x="423" y="118" text-anchor="middle" class="svg-sub">FIFO buffer</text>

          <!-- Horizontal slot bar -->
          <rect x="382" y="134" width="82" height="18" rx="2" fill="#0E1318" stroke="#3A4A5A" stroke-width="1" />
          <rect
            x="384"
            y="136"
            :width="Math.max(2, Math.round(78 * queueFillRatio))"
            height="14"
            :fill="blame === 'queue' ? '#FF4D4F' : '#F5A623'"
          />

          <text x="423" y="172" text-anchor="middle" class="svg-mono-sm">
            {{ formatInt(cfg.queueSize) }} slots
          </text>
          <text x="423" y="187" text-anchor="middle" class="svg-sub">
            {{ (cfg.queueTimeoutMs / 1000).toFixed(1) }} s timeout
          </text>
          <text x="423" y="212" text-anchor="middle" class="svg-sub">
            peak {{ formatInt(result.totals.peakQueue) }}
          </text>
          <text x="423" y="234" text-anchor="middle" class="svg-reject">
            full: {{ formatInt(result.totals.byStatus.FAILED_QUEUE_FULL) }}
          </text>
          <text x="423" y="252" text-anchor="middle" class="svg-reject">
            timeout: {{ formatInt(result.totals.byStatus.FAILED_TIMEOUT) }}
          </text>
        </g>

        <!-- 5. Workers -->
        <g class="node-static">
          <rect x="500" y="112" width="70" height="136" rx="4" fill="#161E26" stroke="#3A4A5A" stroke-width="1.5" />
          <text x="535" y="131" text-anchor="middle" class="svg-title">Workers</text>
          <g v-for="w in 8" :key="w">
            <rect
              :x="514 + ((w - 1) % 2) * 24"
              :y="142 + Math.floor((w - 1) / 2) * 20"
              width="18"
              height="14"
              rx="2"
              fill="#1E2C38"
              stroke="#2ECC71"
              stroke-width="1"
            />
          </g>
          <text x="535" y="236" text-anchor="middle" class="svg-sub">8 × 10 ms</text>
        </g>

        <!-- 6. Seat lock (Postgres) -->
        <g
          class="pipeline-node clickable"
          :class="{
            'is-blamed': blame === 'lock',
            'is-selected': selectedStage === 'lock',
          }"
          tabindex="0"
          role="button"
          aria-label="Seat lock Postgres stage details"
          data-stage="lock"
          @click="emit('selectStage', 'lock')"
          @keydown="handleNodeKey($event, 'lock')"
        >
          <rect x="592" y="76" width="102" height="208" rx="4" class="node-box" />
          <text x="643" y="96" text-anchor="middle" class="svg-title">Seat lock</text>
          <text x="643" y="110" text-anchor="middle" class="svg-sub">Postgres</text>

          <!-- 2x64 mini seat grid (2 coaches of 8x8 cells = 128 berths) -->
          <g v-for="coach in 2" :key="coach">
            <rect
              v-for="cell in 64"
              :key="cell"
              :x="603 + ((cell - 1) % 8) * 10"
              :y="120 + (coach - 1) * 52 + Math.floor((cell - 1) / 8) * 6"
              width="8"
              height="4"
              :fill="(coach - 1) * 64 + cell <= seatsSold ? '#2ECC71' : '#263442'"
            />
          </g>

          <text x="643" y="242" text-anchor="middle" class="svg-mono-xs">SELECT …</text>
          <text x="643" y="255" text-anchor="middle" class="svg-mono-xs">FOR UPDATE</text>
          <text x="643" y="268" text-anchor="middle" class="svg-mono-xs">SKIP LOCKED</text>
        </g>

        <!-- 7. Outcomes column -->
        <g class="outcomes-col">
          <text x="752" y="54" text-anchor="middle" class="svg-title">Outcomes</text>

          <rect x="712" y="68" width="80" height="32" rx="4" fill="#161E26" stroke="#2ECC71" stroke-width="1" />
          <text x="752" y="81" text-anchor="middle" class="svg-sub">CNF</text>
          <text x="752" y="95" text-anchor="middle" class="svg-pass">{{ formatInt(result.totals.byStatus.CNF) }}</text>

          <rect x="712" y="108" width="80" height="32" rx="4" fill="#161E26" stroke="#F5A623" stroke-width="1" />
          <text x="752" y="121" text-anchor="middle" class="svg-sub">WL</text>
          <text x="752" y="135" text-anchor="middle" class="svg-wait">{{ formatInt(result.totals.byStatus.WL) }}</text>

          <rect x="712" y="148" width="80" height="32" rx="4" fill="#161E26" stroke="#3A4A5A" stroke-width="1" />
          <text x="752" y="161" text-anchor="middle" class="svg-sub">REGRET</text>
          <text x="752" y="175" text-anchor="middle" class="svg-mono-sm">{{ formatInt(result.totals.byStatus.REGRET) }}</text>

          <rect x="712" y="188" width="80" height="32" rx="4" fill="#161E26" stroke="#FF4D4F" stroke-width="1" />
          <text x="752" y="201" text-anchor="middle" class="svg-sub">429</text>
          <text x="752" y="215" text-anchor="middle" class="svg-reject">{{ formatInt(result.totals.byStatus.FAILED_429) }}</text>

          <rect x="712" y="228" width="80" height="32" rx="4" fill="#161E26" stroke="#FF4D4F" stroke-width="1" />
          <text x="752" y="241" text-anchor="middle" class="svg-sub">Queue full</text>
          <text x="752" y="255" text-anchor="middle" class="svg-reject">{{ formatInt(result.totals.byStatus.FAILED_QUEUE_FULL) }}</text>

          <rect x="712" y="268" width="80" height="32" rx="4" fill="#161E26" stroke="#FF4D4F" stroke-width="1" />
          <text x="752" y="281" text-anchor="middle" class="svg-sub">Timed out</text>
          <text x="752" y="295" text-anchor="middle" class="svg-reject">{{ formatInt(result.totals.byStatus.FAILED_TIMEOUT) }}</text>
        </g>

        <!-- Click hint -->
        <text x="400" y="360" text-anchor="middle" class="svg-hint">
          Click any stage (Load balancer, Token bucket, Queue, Seat lock) to inspect how it works
        </text>
      </svg>

      <ParticleLayer :tracks="result.tracks" :replay-key="replayKey" />
    </div>

    <p class="blame-line" :class="{ 'is-pass': blame === 'none' }" data-testid="blame-line">
      {{ blameExplanation }}
    </p>
  </div>
</template>

<style scoped>
.pipeline-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pipeline-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.pipeline-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--ops-text);
}

.pipeline-sub {
  font-size: 11px;
  color: var(--ops-muted);
  margin-top: 2px;
}

.replay-btn {
  background: #161E26;
  color: var(--ops-text);
  border: 1px solid var(--ops-node-stroke);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.replay-btn:hover {
  border-color: var(--ops-you);
  color: var(--ops-you);
}

.replay-btn:focus-visible {
  outline: 2px solid var(--ops-you);
  outline-offset: 2px;
}

.diagram-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 800 / 380;
  border: 1px solid var(--ops-node-stroke);
  border-radius: 4px;
  overflow: hidden;
  background: var(--ops-bg);
}

.pipeline-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.node-box {
  fill: var(--ops-node-fill);
  stroke: var(--ops-node-stroke);
  stroke-width: 1.5;
}

.clickable {
  cursor: pointer;
}

.clickable:hover .node-box {
  stroke: #7B95AE;
}

.clickable:focus-visible {
  outline: none;
}

.clickable:focus-visible .node-box,
.clickable.is-selected .node-box {
  stroke: var(--ops-you);
  stroke-width: 2;
}

.pipeline-node.is-blamed .node-box {
  fill: #2B1317;
  stroke: var(--ops-reject);
  stroke-width: 2.5;
  animation: blame-pulse 400ms ease-in-out 2;
}

@keyframes blame-pulse {
  0%, 100% {
    fill: #2B1317;
    stroke: #FF4D4F;
  }
  50% {
    fill: #521A20;
    stroke: #FF787A;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pipeline-node.is-blamed .node-box {
    animation: none;
  }
}

.svg-title {
  fill: #E3ECF5;
  font-size: 11px;
  font-weight: 700;
  font-family: Verdana, Tahoma, Geneva, sans-serif;
}

.svg-sub {
  fill: #8EA0B2;
  font-size: 10px;
  font-family: Verdana, Tahoma, Geneva, sans-serif;
}

.svg-num {
  fill: #FFD400;
  font-size: 14px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.svg-mono-sm {
  fill: #C9D4DF;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.svg-mono-xs {
  fill: #9FB0C1;
  font-size: 9px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.svg-pass {
  fill: #2ECC71;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.svg-wait {
  fill: #F5A623;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.svg-reject {
  fill: #FF4D4F;
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.svg-hint {
  fill: #708396;
  font-size: 10px;
  font-family: Verdana, Tahoma, Geneva, sans-serif;
}

.blame-line {
  margin: 0;
  padding: 8px 10px;
  background: #1B1618;
  border-left: 3px solid var(--ops-reject);
  border-radius: 2px;
  font-size: 12px;
  color: #F0D6D6;
}

.blame-line.is-pass {
  background: #132119;
  border-left-color: var(--ops-pass);
  color: #D1F2DE;
}
</style>

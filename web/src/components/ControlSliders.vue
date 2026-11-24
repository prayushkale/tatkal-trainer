<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULTS, SLIDERS } from '../sim/defaults.ts'
import { formatInt } from '../sim/format.ts'

const props = defineProps<{
  rateLimitPerSec: number
  queueSize: number
  fcfsScore: number
  failedCount: number
  seats: number
}>()

const emit = defineEmits<{
  'update:rateLimitPerSec': [val: number]
  'update:queueSize': [val: number]
}>()

const STEPS = 1000

function toSlider(val: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, val))
  const ratio = (Math.log(clamped) - Math.log(min)) / (Math.log(max) - Math.log(min))
  return Math.round(ratio * STEPS)
}

function fromSlider(pos: number, min: number, max: number): number {
  const ratio = Math.min(1, Math.max(0, pos / STEPS))
  const raw = min * Math.exp(ratio * (Math.log(max) - Math.log(min)))
  if (raw < 100) return Math.round(raw)
  if (raw < 1000) return Math.round(raw / 10) * 10
  return Math.round(raw / 50) * 50
}

const ratePos = computed(() =>
  toSlider(props.rateLimitPerSec, SLIDERS.rateLimit.min, SLIDERS.rateLimit.max),
)
const queuePos = computed(() =>
  toSlider(props.queueSize, SLIDERS.queueSize.min, SLIDERS.queueSize.max),
)

const fcfsPct = computed(() => Math.round(props.fcfsScore * 100))

function onRateInput(e: Event) {
  const pos = Number((e.target as HTMLInputElement).value)
  emit('update:rateLimitPerSec', fromSlider(pos, SLIDERS.rateLimit.min, SLIDERS.rateLimit.max))
}

function onQueueInput(e: Event) {
  const pos = Number((e.target as HTMLInputElement).value)
  emit('update:queueSize', fromSlider(pos, SLIDERS.queueSize.min, SLIDERS.queueSize.max))
}
</script>

<template>
  <div class="sliders-box" data-testid="control-sliders">
    <div class="sliders-title">Try to make it fair</div>

    <div class="slider-row">
      <div class="slider-label-row">
        <label for="rate-slider">Rate limit (Redis token bucket)</label>
        <div class="slider-right">
          <span class="ops-mono slider-val" data-testid="rate-value">
            {{ formatInt(rateLimitPerSec) }} req/s
          </span>
          <button
            type="button"
            class="reset-link"
            @click="emit('update:rateLimitPerSec', DEFAULTS.rateLimitPerSec)"
          >
            Reset to default
          </button>
        </div>
      </div>
      <input
        id="rate-slider"
        type="range"
        min="0"
        :max="STEPS"
        :value="ratePos"
        data-testid="rate-slider"
        @input="onRateInput"
      />
      <div class="slider-bounds ops-mono">
        <span>100 req/s</span>
        <span>20,000 req/s</span>
      </div>
    </div>

    <div class="slider-row">
      <div class="slider-label-row">
        <label for="queue-slider">Queue size (FIFO buffer)</label>
        <div class="slider-right">
          <span class="ops-mono slider-val" data-testid="queue-value">
            {{ formatInt(queueSize) }} slots
          </span>
          <button
            type="button"
            class="reset-link"
            @click="emit('update:queueSize', DEFAULTS.queueSize)"
          >
            Reset to default
          </button>
        </div>
      </div>
      <input
        id="queue-slider"
        type="range"
        min="0"
        :max="STEPS"
        :value="queuePos"
        data-testid="queue-slider"
        @input="onQueueInput"
      />
      <div class="slider-bounds ops-mono">
        <span>10 slots</span>
        <span>50,000 slots</span>
      </div>
    </div>

    <div class="fairness-stats ops-mono">
      <div data-testid="fcfs-score">
        FCFS score: {{ fcfsPct }}% of the first {{ formatInt(seats) }} clickers got a seat
      </div>
      <div data-testid="failed-count">
        Requests that failed outright: {{ formatInt(failedCount) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.sliders-box {
  background: #121920;
  border: 1px solid var(--ops-node-stroke);
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sliders-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ops-text);
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--ops-text);
}

.slider-right {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.slider-val {
  color: var(--ops-you);
  font-weight: 700;
}

.reset-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--ops-muted);
  font-family: var(--font-book);
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

.reset-link:hover {
  color: var(--ops-text);
}

input[type='range'] {
  width: 100%;
  accent-color: #FFD400;
  cursor: pointer;
}

.slider-bounds {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--ops-muted);
}

.fairness-stats {
  border-top: 1px solid #263442;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ops-text);
}
</style>

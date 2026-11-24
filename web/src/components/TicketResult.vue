<script setup lang="ts">
import { computed } from 'vue'
import {
  formatClockWithMs,
  formatInt,
  formatOffset,
  statusLabel,
} from '../sim/format.ts'
import type { RaceResult } from '../sim/types.ts'
import ShareButton from './ShareButton.vue'

const props = defineProps<{
  originalResult: RaceResult
  currentResult: RaceResult
  slidersChanged: boolean
  totalRequests: number
  seatsTotal: number
  attempts: number
  bestLabel: string
  shareUrl: string
}>()

const emit = defineEmits<{
  tryAgain: []
  sameRace: []
}>()

const originalStamp = computed(() => statusLabel(props.originalResult.user))
const isCnf = computed(() => props.originalResult.user.status === 'CNF')

const seatsGoneLine = computed(() => {
  const ms = props.originalResult.totals.seatsGoneAtMs
  if (ms === null) return 'Seats never ran out'
  return `All ${formatInt(props.seatsTotal)} seats gone at ${formatClockWithMs(ms)}`
})

const sliderDeltaText = computed(() => {
  if (!props.slidersChanged) return ''
  const orig = statusLabel(props.originalResult.user)
  const curr = statusLabel(props.currentResult.user)
  if (orig === curr) {
    return "With these settings you'd have got: the same result"
  }
  return `With these settings you'd have got: ${curr}`
})
</script>

<template>
  <div class="result-card" data-testid="ticket-result">
    <div class="stamp-stage">
      <div
        class="result-stamp"
        :class="isCnf ? 'stamp-cnf' : 'stamp-bad'"
        data-testid="result-stamp"
      >
        {{ originalStamp }}
      </div>
    </div>

    <div
      v-if="slidersChanged"
      class="slider-delta"
      data-testid="slider-delta"
    >
      {{ sliderDeltaText }}
    </div>

    <div class="result-meta">
      <p class="ops-mono">
        You clicked at {{ formatOffset(originalResult.userDelayMs) }} · request
        #{{ formatInt(originalResult.userRankByClick) }} of
        {{ formatInt(totalRequests) }} by click time
      </p>
      <p class="ops-mono">{{ seatsGoneLine }}</p>
      <p class="ops-mono">Race #{{ originalResult.seed }}</p>
      <p class="practice-log ops-mono">
        Attempts: {{ formatInt(attempts) }} · Best: {{ bestLabel }}
      </p>
    </div>

    <div class="result-actions">
      <button
        type="button"
        class="retro-btn"
        data-testid="try-again-btn"
        @click="emit('tryAgain')"
      >
        Try again
      </button>
      <button
        type="button"
        class="retro-btn"
        data-testid="same-race-btn"
        @click="emit('sameRace')"
      >
        Same race again
      </button>
      <ShareButton
        :outcome="originalResult.user"
        :share-url="shareUrl"
      />
    </div>
  </div>
</template>

<style scoped>
.result-card {
  border: 1px solid var(--book-rule);
  background: #FFFFFF;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stamp-stage {
  display: flex;
  justify-content: center;
  padding: 10px 4px 6px;
}

.result-stamp {
  display: inline-block;
  padding: 8px 16px;
  border: 3px solid currentColor;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 22px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transform: rotate(-4deg);
  animation: stamp-drop 120ms ease-out;
  max-width: 100%;
  text-align: center;
  word-break: break-word;
}

.stamp-cnf {
  color: var(--stamp-cnf);
}

.stamp-bad {
  color: var(--stamp-bad);
}

@keyframes stamp-drop {
  from {
    transform: rotate(-4deg) scale(1.15);
    opacity: 0.7;
  }
  to {
    transform: rotate(-4deg) scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-stamp {
    animation: none;
  }
}

.slider-delta {
  background: #EFECE2;
  border: 1px solid var(--book-rule);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--book-header);
  text-align: center;
}

.result-meta {
  border-top: 1px solid var(--book-rule);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-meta p {
  margin: 0;
  font-size: 12px;
  color: var(--book-text);
}

.practice-log {
  color: var(--book-muted);
  margin-top: 2px;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}
</style>

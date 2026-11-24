<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BookingScreen from './components/BookingScreen.vue'
import ControlSliders from './components/ControlSliders.vue'
import PipelineView from './components/PipelineView.vue'
import StageDrawer from './components/StageDrawer.vue'
import TicketResult from './components/TicketResult.vue'
import WaitingBar from './components/WaitingBar.vue'
import YourTimeline from './components/YourTimeline.vue'
import { useCountdown } from './composables/useCountdown.ts'
import { usePracticeLog } from './composables/usePracticeLog.ts'
import { useUrlParams } from './composables/useUrlParams.ts'
import { DEFAULTS } from './sim/defaults.ts'
import { runRace } from './sim/race.ts'
import type { RaceResult, SimConfig, Stage } from './sim/types.ts'

type Phase = 'countdown' | 'waiting' | 'result'

const WAIT_DURATION_MS = 400

const { seed, startSeconds, randomizeSeed, buildShareUrl } = useUrlParams()
const { offsetMs, isOpen, countdownProgress, restart, stop, currentOffsetMs } =
  useCountdown(startSeconds.value)
const { log, recordOutcome, bestLabel } = usePracticeLog()

const phase = ref<Phase>('countdown')
const rateLimitPerSec = ref<number>(DEFAULTS.rateLimitPerSec)
const queueSize = ref<number>(DEFAULTS.queueSize)
const selectedStage = ref<Stage | null>(null)

const originalResult = ref<RaceResult | null>(null)
const currentResult = ref<RaceResult | null>(null)
const slidersChanged = ref(false)
const frozenOffsetMs = ref<number>(0)

let waitTimer: number | null = null
let sliderDebounceTimer: number | null = null

const activeConfig = computed<SimConfig>(() => ({
  ...DEFAULTS,
  rateLimitPerSec: rateLimitPerSec.value,
  queueSize: queueSize.value,
}))

const displayedOffsetMs = computed(() =>
  phase.value === 'countdown' ? offsetMs.value : frozenOffsetMs.value,
)

const shareUrl = computed(() => buildShareUrl(seed.value))

const currentFailedCount = computed(() => {
  const res = currentResult.value
  if (!res) return 0
  return (
    res.totals.byStatus.FAILED_429 +
    res.totals.byStatus.FAILED_QUEUE_FULL +
    res.totals.byStatus.FAILED_TIMEOUT
  )
})

function clearTimers() {
  if (waitTimer !== null) {
    window.clearTimeout(waitTimer)
    waitTimer = null
  }
  if (sliderDebounceTimer !== null) {
    window.clearTimeout(sliderDebounceTimer)
    sliderDebounceTimer = null
  }
}

function handleBook(clickOffsetMs: number) {
  if (phase.value !== 'countdown') return
  stop()
  frozenOffsetMs.value = clickOffsetMs

  const res = runRace(activeConfig.value, seed.value, clickOffsetMs)
  originalResult.value = res
  currentResult.value = res
  slidersChanged.value = false
  selectedStage.value = null
  recordOutcome(res.user)

  phase.value = 'waiting'
  waitTimer = window.setTimeout(() => {
    phase.value = 'result'
  }, WAIT_DURATION_MS)
}

function resetToCountdown(freshSeed: boolean) {
  clearTimers()
  if (freshSeed) {
    randomizeSeed()
  }
  originalResult.value = null
  currentResult.value = null
  slidersChanged.value = false
  selectedStage.value = null
  phase.value = 'countdown'
  restart(5)
}

function handleSelectStage(stage: Stage) {
  selectedStage.value = selectedStage.value === stage ? null : stage
}

watch([rateLimitPerSec, queueSize], () => {
  if (phase.value !== 'result' || !originalResult.value) return
  if (sliderDebounceTimer !== null) {
    window.clearTimeout(sliderDebounceTimer)
  }
  sliderDebounceTimer = window.setTimeout(() => {
    if (!originalResult.value) return
    currentResult.value = runRace(
      activeConfig.value,
      originalResult.value.seed,
      originalResult.value.userDelayMs,
    )
    slidersChanged.value = true
  }, 150)
})

onUnmounted(clearTimers)
</script>

<template>
  <main class="app-root" :class="{ 'is-split': phase === 'result' }">
    <div class="booking-pane">
      <BookingScreen
        :offset-ms="displayedOffsetMs"
        :is-open="phase === 'countdown' ? isOpen : true"
        :countdown-progress="countdownProgress"
        :bots-total="DEFAULTS.bots"
        :seats-total="DEFAULTS.seats"
        :seed="seed"
        :current-offset-ms="currentOffsetMs"
        :show-form-body="phase === 'countdown'"
        :compact-layout="phase === 'result'"
        @book="handleBook"
      >
        <WaitingBar v-if="phase === 'waiting'" :duration-ms="WAIT_DURATION_MS" />

        <TicketResult
          v-else-if="phase === 'result' && originalResult && currentResult"
          :original-result="originalResult"
          :current-result="currentResult"
          :sliders-changed="slidersChanged"
          :total-requests="DEFAULTS.bots + 1"
          :seats-total="DEFAULTS.seats"
          :attempts="log.attempts"
          :best-label="bestLabel"
          :share-url="shareUrl"
          @try-again="resetToCountdown(true)"
          @same-race="resetToCountdown(false)"
        />
      </BookingScreen>
    </div>

    <section
      v-if="phase === 'result' && currentResult"
      class="backend-pane ops-world"
      aria-label="Toy backend pipeline"
      data-testid="backend-pane"
    >
      <PipelineView
        :result="currentResult"
        :cfg="activeConfig"
        :selected-stage="selectedStage"
        @select-stage="handleSelectStage"
      />

      <StageDrawer
        :stage="selectedStage"
        :queue-size="queueSize"
        :rate-limit-per-sec="rateLimitPerSec"
        @close="selectedStage = null"
      />

      <YourTimeline :timeline="currentResult.timeline" />

      <ControlSliders
        v-model:rate-limit-per-sec="rateLimitPerSec"
        v-model:queue-size="queueSize"
        :fcfs-score="currentResult.fcfsScore"
        :failed-count="currentFailedCount"
        :seats="DEFAULTS.seats"
      />
    </section>
  </main>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: var(--book-page);
}

.booking-pane {
  width: 100%;
  max-width: 960px;
  min-width: 0;
}

.app-root.is-split {
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
  justify-content: stretch;
}

.app-root.is-split .booking-pane {
  max-width: none;
  padding: 14px;
  background: var(--book-page);
}

.backend-pane {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  border-left: 2px solid #263442;
}

@media (max-width: 899px) {
  .app-root {
    padding: 8px;
  }

  .app-root.is-split {
    grid-template-columns: 1fr;
    padding: 0;
  }

  .app-root.is-split .booking-pane {
    padding: 8px;
  }

  .backend-pane {
    padding: 12px 10px 24px;
    border-left: none;
    border-top: 2px solid #263442;
  }
}
</style>

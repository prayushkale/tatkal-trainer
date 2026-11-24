<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatInt } from '../sim/format.ts'
import LedClock from './LedClock.vue'

const props = defineProps<{
  offsetMs: number
  isOpen: boolean
  countdownProgress: number
  botsTotal: number
  seatsTotal: number
  seed: number
  currentOffsetMs: () => number
  showFormBody: boolean
  compactLayout?: boolean
}>()

const emit = defineEmits<{
  book: [offsetMs: number]
}>()

const earlyWarning = ref(false)
const shaking = ref(false)
let shakeTimer: number | null = null

const tomorrowFormatted = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
})

const botsConnected = computed(() => {
  if (props.isOpen) return props.botsTotal
  return Math.round(props.botsTotal * props.countdownProgress)
})

function triggerEarlyFeedback() {
  earlyWarning.value = true
  shaking.value = false
  if (shakeTimer !== null) window.clearTimeout(shakeTimer)
  requestAnimationFrame(() => {
    shaking.value = true
    shakeTimer = window.setTimeout(() => {
      shaking.value = false
    }, 260)
  })
}

function handleAttempt() {
  const exactOffset = props.currentOffsetMs()
  if (exactOffset < 0) {
    triggerEarlyFeedback()
    return
  }
  earlyWarning.value = false
  emit('book', Math.max(0, exactOffset))
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  handleAttempt()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleAttempt()
  }
}
</script>

<template>
  <section class="booking-shell">
    <header class="retro-header-band booking-header">
      <span>TATKAL TRAINER · practice booking</span>
      <span class="race-tag ops-mono">Race #{{ seed }}</span>
    </header>

    <div class="step-bar" aria-label="Booking progress">
      <span class="step-item">1 Journey</span>
      <span class="step-sep" aria-hidden="true">›</span>
      <span class="step-item active" aria-current="step">2 Passengers</span>
      <span class="step-sep" aria-hidden="true">›</span>
      <span class="step-item">3 Payment</span>
    </div>

    <div class="booking-body">
      <div class="top-row" :class="{ stacked: compactLayout }">
        <div class="clock-slot">
          <LedClock :offset-ms="offsetMs" :is-open="isOpen" />
        </div>

        <div class="journey-wrap">
          <div class="section-caption">Journey Details · {{ seatsTotal }} Tatkal berths available</div>
          <table class="retro-table journey-table">
            <thead>
              <tr>
                <th>Train</th>
                <th>From</th>
                <th>To</th>
                <th>Date</th>
                <th>Class</th>
                <th>Quota</th>
                <th>Fare</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="train-name">22999 VIDARBHA PRACTICE EXP</td>
                <td>NGP Nagpur</td>
                <td>CSMT Mumbai</td>
                <td class="ops-mono nowrap">{{ tomorrowFormatted }}</td>
                <td>3A</td>
                <td>TATKAL</td>
                <td class="ops-mono nowrap">₹1,845</td>
              </tr>
            </tbody>
          </table>

          <table class="retro-table journey-table-mobile">
            <tbody>
              <tr>
                <th>Train</th>
                <td colspan="3" class="train-name">22999 VIDARBHA PRACTICE EXP</td>
              </tr>
              <tr>
                <th>From</th>
                <td>NGP Nagpur</td>
                <th>To</th>
                <td>CSMT Mumbai</td>
              </tr>
              <tr>
                <th>Date</th>
                <td class="ops-mono">{{ tomorrowFormatted }}</td>
                <th>Class / Quota</th>
                <td>3A · TATKAL</td>
              </tr>
              <tr>
                <th>Fare</th>
                <td colspan="3" class="ops-mono">₹1,845</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template v-if="showFormBody">
        <div class="passenger-wrap">
          <div class="section-caption">Passenger Details</div>
          <div class="table-scroll">
            <table class="retro-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th>Berth Preference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>YOU</td>
                  <td class="ops-mono">29</td>
                  <td>M</td>
                  <td>Lower (it won't matter)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="cta-box">
          <div class="bots-line ops-mono">
            bots connected: {{ formatInt(botsConnected) }}
          </div>

          <button
            type="button"
            class="book-btn"
            :class="{ open: isOpen, shake: shaking }"
            :aria-disabled="!isOpen ? 'true' : 'false'"
            data-testid="book-btn"
            @pointerdown="onPointerDown"
            @keydown="onKeyDown"
          >
            Book Now
          </button>

          <div class="early-msg" role="status" aria-live="polite">
            <span v-if="earlyWarning && !isOpen">Booking opens at 10:00:00</span>
            <span v-else-if="isOpen">Window open. {{ seatsTotal }} seats for {{ formatInt(botsTotal + 1) }} requests.</span>
            <span v-else>Wait for 10:00:00, then press Book Now.</span>
          </div>
        </div>
      </template>

      <slot />
    </div>

    <footer class="booking-footer">
      Toy model I wrote. Not IRCTC's real architecture. Not affiliated with IRCTC or Indian Railways.
    </footer>
  </section>
</template>

<style scoped>
.booking-shell {
  background: var(--book-panel);
  border: 1px solid var(--book-rule);
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.booking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.race-tag {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.9;
}

.step-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #E2E7EE;
  border-bottom: 1px solid var(--book-rule);
  font-size: 11px;
  color: var(--book-muted);
}

.step-item.active {
  color: var(--book-header);
  font-weight: 700;
  text-decoration: underline;
}

.step-sep {
  color: var(--book-rule);
}

.booking-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.top-row {
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.top-row.stacked {
  flex-direction: column;
  align-items: stretch;
}

.top-row.stacked .clock-slot {
  align-self: center;
}

.clock-slot {
  flex: 0 0 auto;
}

.journey-wrap {
  flex: 1 1 auto;
  min-width: 0;
}

.journey-table-mobile {
  display: none;
}

.nowrap {
  white-space: nowrap;
}

.passenger-wrap {
  min-width: 0;
}

.section-caption {
  font-size: 11px;
  font-weight: 700;
  color: var(--book-header);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.train-name {
  font-weight: 700;
}

.cta-box {
  border: 1px solid var(--book-rule);
  background: #EFECE2;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bots-line {
  font-size: 12px;
  color: var(--book-text);
  font-weight: 700;
}

.book-btn {
  min-width: 196px;
  padding: 11px 28px;
  font-family: var(--font-book);
  font-size: 15px;
  font-weight: 700;
  border-radius: 2px;
  border: 2px outset #D8D3C8;
  background: var(--book-disabled);
  color: #4A4843;
  cursor: not-allowed;
  touch-action: manipulation;
  user-select: none;
}

.book-btn.open {
  background: var(--book-cta);
  color: #FFFFFF;
  border-color: #F4A261;
  cursor: pointer;
}

.book-btn.open:hover {
  background: var(--book-cta-hover);
}

.book-btn.open:active {
  border-style: inset;
}

.book-btn:focus-visible {
  outline: 2px solid var(--book-header);
  outline-offset: 2px;
}

.book-btn.shake {
  animation: btn-shake 240ms linear;
}

@keyframes btn-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .book-btn.shake {
    animation: none;
  }
}

.early-msg {
  font-size: 12px;
  color: var(--book-muted);
  min-height: 18px;
  text-align: center;
}

.booking-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--book-rule);
  background: #E9E4D6;
  font-size: 11px;
  color: var(--book-muted);
}

@media (max-width: 760px) {
  .top-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 560px) {
  .journey-table {
    display: none;
  }

  .journey-table-mobile {
    display: table;
  }
}
</style>

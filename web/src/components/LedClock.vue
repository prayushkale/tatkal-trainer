<script setup lang="ts">
import { computed } from 'vue'
import { formatClock, formatOffset } from '../sim/format.ts'

const props = defineProps<{
  offsetMs: number
  isOpen: boolean
}>()

const clockText = computed(() => formatClock(props.offsetMs))
const offsetText = computed(() => formatOffset(props.offsetMs))
</script>

<template>
  <div class="led-panel" aria-live="off">
    <div class="led-label">Tatkal opens 10:00:00</div>
    <div class="led-readout">
      <span class="led-ghost" aria-hidden="true">88:88:88</span>
      <span class="led-digits" data-testid="led-clock">{{ clockText }}</span>
    </div>
    <div class="led-sub" :class="{ visible: isOpen }" data-testid="led-offset">
      {{ isOpen ? offsetText : '&nbsp;' }}
    </div>
  </div>
</template>

<style scoped>
.led-panel {
  background: var(--led-bg);
  border: 2px inset #525252;
  border-radius: 2px;
  padding: 8px 14px 6px;
  text-align: center;
  min-width: 248px;
}

.led-label {
  font-family: var(--font-book);
  font-size: 11px;
  color: #B4B8BC;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
}

.led-readout {
  position: relative;
  display: inline-block;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 56px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0.04em;
}

.led-ghost {
  color: var(--led-unlit);
  user-select: none;
}

.led-digits {
  position: absolute;
  inset: 0;
  color: var(--led-lit);
}

.led-sub {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--led-lit);
  min-height: 18px;
  margin-top: 2px;
  visibility: hidden;
}

.led-sub.visible {
  visibility: visible;
}

@media (max-width: 640px) {
  .led-panel {
    min-width: 0;
    width: 100%;
    padding: 6px 10px 4px;
  }

  .led-readout {
    font-size: 40px;
  }
}
</style>

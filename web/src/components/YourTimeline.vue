<script setup lang="ts">
import { computed } from 'vue'
import { formatInt } from '../sim/format.ts'
import type { StageSpan } from '../sim/types.ts'

const props = defineProps<{
  timeline: StageSpan[]
}>()

const STAGE_META: Record<StageSpan['stage'], { label: string; color: string }> = {
  network: { label: 'Network + LB', color: '#4B6B8A' },
  lb: { label: 'Load balancer', color: '#5D7B9A' },
  bucket: { label: 'Token bucket retry', color: '#FF4D4F' },
  queue: { label: 'Queue wait', color: '#F5A623' },
  lock: { label: 'Seat lock', color: '#2ECC71' },
}

const totalMs = computed(() => props.timeline.reduce((s, item) => s + item.ms, 0))

const segments = computed(() => {
  const total = Math.max(1, totalMs.value)
  return props.timeline
    .filter((item) => item.ms > 0)
    .map((item) => ({
      ...item,
      label: STAGE_META[item.stage].label,
      color: STAGE_META[item.stage].color,
      pct: Math.max(3, (item.ms / total) * 100),
    }))
})
</script>

<template>
  <div class="timeline-box" data-testid="your-timeline">
    <div class="timeline-head">
      <span>Your request breakdown</span>
      <span class="ops-mono">your request took {{ formatInt(totalMs) }} ms (simulated)</span>
    </div>

    <div class="timeline-bar" role="img" :aria-label="`Request took ${formatInt(totalMs)} ms`">
      <div
        v-for="seg in segments"
        :key="seg.stage"
        class="timeline-seg ops-mono"
        :style="{ width: `${seg.pct}%`, backgroundColor: seg.color }"
        :title="`${seg.label}: ${formatInt(seg.ms)} ms`"
      >
        <span v-if="seg.pct >= 14">{{ formatInt(seg.ms) }} ms</span>
      </div>
    </div>

    <div class="timeline-legend">
      <span v-for="seg in segments" :key="seg.stage" class="legend-item ops-mono">
        <span class="swatch" :style="{ backgroundColor: seg.color }" />
        {{ seg.label }}: {{ formatInt(seg.ms) }} ms
      </span>
    </div>
  </div>
</template>

<style scoped>
.timeline-box {
  background: #121920;
  border: 1px solid var(--ops-node-stroke);
  border-radius: 4px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--ops-text);
}

.timeline-bar {
  display: flex;
  width: 100%;
  height: 24px;
  background: #0B1014;
  border: 1px solid #2A3846;
  border-radius: 2px;
  overflow: hidden;
}

.timeline-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0E1318;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  padding: 0 4px;
  border-right: 1px solid #0E1318;
}

.timeline-seg:last-child {
  border-right: none;
}

.timeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  font-size: 11px;
  color: var(--ops-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  display: inline-block;
}
</style>

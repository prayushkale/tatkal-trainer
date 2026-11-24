<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  durationMs: number
}>()

const filledBlocks = ref(1)
const TOTAL_BLOCKS = 16
let rafId: number | null = null

onMounted(() => {
  const start = performance.now()
  const tick = () => {
    const elapsed = performance.now() - start
    const ratio = Math.min(1, elapsed / Math.max(1, props.durationMs))
    filledBlocks.value = Math.max(1, Math.round(ratio * TOTAL_BLOCKS))
    if (ratio < 1) {
      rafId = requestAnimationFrame(tick)
    }
  }
  rafId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="waiting-box" role="status" aria-live="polite" data-testid="waiting-bar">
    <div class="waiting-title">Please wait… processing your request</div>
    <div class="block-track" aria-hidden="true">
      <div
        v-for="i in TOTAL_BLOCKS"
        :key="i"
        class="block-cell"
        :class="{ filled: i <= filledBlocks }"
      />
    </div>
    <div class="waiting-sub">Checking seat inventory and rate limits. Do not refresh.</div>
  </div>
</template>

<style scoped>
.waiting-box {
  border: 1px solid var(--book-rule);
  background: #FFFFFF;
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.waiting-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--book-header);
}

.block-track {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 2px;
  width: 100%;
  max-width: 320px;
  padding: 3px;
  border: 2px inset #9AA7B8;
  background: #EFECE2;
}

.block-cell {
  height: 16px;
  background: transparent;
}

.block-cell.filled {
  background: var(--book-header);
}

.waiting-sub {
  font-size: 11px;
  color: var(--book-muted);
}
</style>

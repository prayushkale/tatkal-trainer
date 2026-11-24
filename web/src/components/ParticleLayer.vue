<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { FinalStatus, ParticleTrack } from '../sim/types.ts'

const props = defineProps<{
  tracks: ParticleTrack[]
  replayKey: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const reducedMotion = ref(false)
let rafId: number | null = null
let startTimer: number | null = null

const VIEW_W = 800
const VIEW_H = 380
const REPLAY_DURATION_MS = 2500

const STAGE_X: Record<string, number> = {
  start: 58,
  lb: 170,
  bucket: 293,
  queue: 423,
  lock: 643,
  out: 706,
}

const OUTCOME_Y: Record<FinalStatus, number> = {
  CNF: 84,
  WL: 124,
  REGRET: 164,
  FAILED_429: 204,
  FAILED_QUEUE_FULL: 244,
  FAILED_TIMEOUT: 284,
}

function outcomeColor(outcome?: FinalStatus): string {
  switch (outcome) {
    case 'CNF':
      return '#2ECC71'
    case 'WL':
      return '#F5A623'
    case 'REGRET':
    case 'FAILED_429':
    case 'FAILED_QUEUE_FULL':
    case 'FAILED_TIMEOUT':
      return '#FF4D4F'
    default:
      return '#8DA2B5'
  }
}

function jitterY(id: number): number {
  const hash = ((id * 2654435761) >>> 0) % 1000
  return (hash / 1000 - 0.5) * 64
}

const maxSimTime = computed(() => {
  let maxT = 1
  for (const tr of props.tracks) {
    const last = tr.events[tr.events.length - 1]
    if (last && last.t > maxT) maxT = last.t
  }
  return maxT
})

function stopAnim() {
  if (startTimer !== null) {
    window.clearTimeout(startTimer)
    startTimer = null
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function drawFrame(simT: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const targetW = Math.round(rect.width * dpr)
  const targetH = Math.round(rect.height * dpr)
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }

  ctx.save()
  ctx.scale(targetW / VIEW_W, targetH / VIEW_H)
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)

  let userPos: { x: number; y: number } | null = null

  for (const tr of props.tracks) {
    const evs = tr.events
    if (evs.length === 0) continue

    const first = evs[0]!
    if (simT < Math.max(0, first.t - 40)) continue

    const jy = tr.isUser ? 0 : jitterY(tr.id)
    let x = STAGE_X.start!
    let y = 180 + jy
    let color = '#8DA2B5'

    const last = evs[evs.length - 1]!
    if (simT >= last.t) {
      x = STAGE_X[last.at] ?? STAGE_X.out!
      y = last.at === 'out' && last.outcome ? OUTCOME_Y[last.outcome] : 180 + jy
      color = outcomeColor(last.outcome)
    } else if (simT <= first.t) {
      const span = Math.max(1, first.t - Math.max(0, first.t - 40))
      const u = Math.max(0, Math.min(1, (simT - Math.max(0, first.t - 40)) / span))
      const tx = STAGE_X[first.at] ?? STAGE_X.lb!
      x = STAGE_X.start! + (tx - STAGE_X.start!) * u
      y = 180 + jy
    } else {
      for (let i = 0; i < evs.length - 1; i++) {
        const a = evs[i]!
        const b = evs[i + 1]!
        if (simT >= a.t && simT <= b.t) {
          const span = Math.max(0.001, b.t - a.t)
          const u = (simT - a.t) / span
          const ax = STAGE_X[a.at] ?? STAGE_X.lb!
          const bx = STAGE_X[b.at] ?? STAGE_X.out!
          const ay = a.at === 'out' && a.outcome ? OUTCOME_Y[a.outcome] : 180 + jy
          const by = b.at === 'out' && b.outcome ? OUTCOME_Y[b.outcome] : 180 + jy
          x = ax + (bx - ax) * u
          y = ay + (by - ay) * u
          if (b.at === 'out' && u > 0.5) {
            color = outcomeColor(b.outcome)
          }
          break
        }
      }
    }

    if (tr.isUser) {
      userPos = { x, y }
    } else {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.72
      ctx.beginPath()
      ctx.arc(x, y, 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (userPos) {
    ctx.globalAlpha = 1
    ctx.fillStyle = '#FFD400'
    ctx.beginPath()
    ctx.arc(userPos.x, userPos.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0E1318'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace'
    ctx.fillStyle = '#FFD400'
    if (userPos.x > 680) {
      ctx.textAlign = 'right'
      ctx.fillText('YOU', userPos.x - 8, userPos.y + 3)
    } else {
      ctx.textAlign = 'center'
      ctx.fillText('YOU', userPos.x, userPos.y - 9)
    }
  }

  ctx.restore()
}

function startReplay() {
  stopAnim()
  if (reducedMotion.value) return

  startTimer = window.setTimeout(() => {
    const wallStart = performance.now()
    const totalSim = maxSimTime.value
    const step = () => {
      const elapsed = performance.now() - wallStart
      const ratio = Math.min(1, elapsed / REPLAY_DURATION_MS)
      drawFrame(ratio * totalSim)
      if (ratio < 1) {
        rafId = requestAnimationFrame(step)
      }
    }
    rafId = requestAnimationFrame(step)
  }, 300)
}

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  startReplay()
})

watch(
  () => [props.tracks, props.replayKey],
  () => {
    startReplay()
  },
)

onUnmounted(stopAnim)
</script>

<template>
  <canvas
    v-if="!reducedMotion"
    ref="canvasRef"
    class="particle-canvas"
    aria-hidden="true"
  />
</template>

<style scoped>
.particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>

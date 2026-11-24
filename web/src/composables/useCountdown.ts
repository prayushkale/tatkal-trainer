import { computed, onUnmounted, ref } from 'vue'

export function useCountdown(initialStartSeconds: number) {
  let startSec = initialStartSeconds
  let openAt = performance.now() + startSec * 1000
  let rafId: number | null = null

  const offsetMs = ref<number>(-startSec * 1000)
  const isOpen = computed(() => offsetMs.value >= 0)
  const countdownProgress = computed(() => {
    if (offsetMs.value >= 0) return 1
    const total = startSec * 1000
    if (total <= 0) return 1
    return Math.max(0, Math.min(1, 1 + offsetMs.value / total))
  })

  function tick() {
    offsetMs.value = performance.now() - openAt
    rafId = requestAnimationFrame(tick)
  }

  function startLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(tick)
  }

  function restart(secondsBefore = startSec) {
    startSec = secondsBefore
    openAt = performance.now() + startSec * 1000
    offsetMs.value = -startSec * 1000
    startLoop()
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function currentOffsetMs(): number {
    return performance.now() - openAt
  }

  startLoop()
  onUnmounted(stop)

  return {
    offsetMs,
    isOpen,
    countdownProgress,
    restart,
    stop,
    currentOffsetMs,
  }
}

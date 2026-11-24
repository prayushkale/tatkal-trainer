<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { statusLabel } from '../sim/format.ts'
import type { Blame, UserOutcome } from '../sim/types.ts'

const props = defineProps<{
  outcome: UserOutcome
  shareUrl: string
}>()

const copied = ref(false)
let resetTimer: number | null = null

const BLAME_NAMES: Record<Blame, string> = {
  none: 'seat lock',
  bucket: 'token bucket',
  queue: 'request queue',
  lock: 'seat lock',
}

function buildText(): string {
  const label = statusLabel(props.outcome)
  if (props.outcome.blame === 'none') {
    return `I got ${label} on Tatkal Trainer. Same race: ${props.shareUrl}`
  }
  return `I got ${label} on Tatkal Trainer. The ${BLAME_NAMES[props.outcome.blame]} rejected me. Same race: ${props.shareUrl}`
}

function showCopied() {
  copied.value = true
  if (resetTimer !== null) window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    copied.value = false
  }, 1500)
}

async function handleShare() {
  const text = buildText()

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: 'Tatkal Trainer',
        text,
        url: props.shareUrl,
      })
      showCopied()
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      showCopied()
      return
    } catch {
      // fallback below
    }
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
    showCopied()
  } finally {
    document.body.removeChild(ta)
  }
}

onUnmounted(() => {
  if (resetTimer !== null) window.clearTimeout(resetTimer)
})
</script>

<template>
  <button
    type="button"
    class="retro-btn"
    data-testid="share-btn"
    @click="handleShare"
  >
    {{ copied ? 'Copied' : 'Share' }}
  </button>
</template>

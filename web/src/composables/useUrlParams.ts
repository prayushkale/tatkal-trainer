import { ref } from 'vue'

function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 999_999)
}

function parseIntParam(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export function useUrlParams() {
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()

  const parsedSeed = parseIntParam(params.get('seed'))
  const initialSeed = parsedSeed !== null && parsedSeed >= 1 ? parsedSeed : randomSeed()

  const parsedStart = parseIntParam(params.get('start'))
  const initialStart = parsedStart !== null ? Math.min(30, Math.max(1, parsedStart)) : 5

  const seed = ref<number>(initialSeed)
  const startSeconds = ref<number>(initialStart)

  function randomizeSeed(): number {
    const next = randomSeed()
    seed.value = next
    return next
  }

  function buildShareUrl(targetSeed: number): string {
    if (typeof window === 'undefined') return `?seed=${targetSeed}`
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('seed', String(targetSeed))
    return url.toString()
  }

  return {
    seed,
    startSeconds,
    randomizeSeed,
    buildShareUrl,
  }
}

import { computed, ref } from 'vue'
import { statusLabel } from '../sim/format.ts'
import type { FinalStatus, UserOutcome } from '../sim/types.ts'

const STORAGE_KEY = 'tatkal-trainer:v1'

export interface BestRecord {
  status: FinalStatus
  seat?: string
  wl?: number
}

export interface PracticeLog {
  attempts: number
  best: BestRecord | null
}

function rankRecord(r: BestRecord): number {
  switch (r.status) {
    case 'CNF':
      return 0
    case 'WL':
      return 1000 + (r.wl ?? 999_999)
    case 'REGRET':
      return 2_000_000
    case 'FAILED_TIMEOUT':
    case 'FAILED_QUEUE_FULL':
    case 'FAILED_429':
      return 3_000_000
  }
}

function loadLog(): PracticeLog {
  if (typeof window === 'undefined') return { attempts: 0, best: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { attempts: 0, best: null }
    const parsed = JSON.parse(raw) as Partial<PracticeLog>
    if (typeof parsed.attempts !== 'number') return { attempts: 0, best: null }
    return {
      attempts: parsed.attempts,
      best: parsed.best ?? null,
    }
  } catch {
    return { attempts: 0, best: null }
  }
}

function saveLog(log: PracticeLog): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function usePracticeLog() {
  const log = ref<PracticeLog>(loadLog())

  function recordOutcome(outcome: UserOutcome): void {
    const candidate: BestRecord = {
      status: outcome.status,
      ...(outcome.seat !== undefined ? { seat: outcome.seat } : {}),
      ...(outcome.wl !== undefined ? { wl: outcome.wl } : {}),
    }
    const prevBest = log.value.best
    const nextBest =
      prevBest === null || rankRecord(candidate) < rankRecord(prevBest) ? candidate : prevBest

    log.value = {
      attempts: log.value.attempts + 1,
      best: nextBest,
    }
    saveLog(log.value)
  }

  const bestLabel = computed(() => {
    if (!log.value.best) return '-'
    const b = log.value.best
    if (b.status === 'FAILED_429') return 'FAILED 429'
    if (b.status === 'FAILED_TIMEOUT') return 'TIMEOUT'
    if (b.status === 'FAILED_QUEUE_FULL') return 'QUEUE FULL'
    return statusLabel(b)
  })

  return {
    log,
    recordOutcome,
    bestLabel,
  }
}

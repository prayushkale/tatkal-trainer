import type { FinalStatus } from './types.ts'

const INT_FMT = new Intl.NumberFormat('en-US')

export function formatClock(offsetMs: number): string {
  const baseSec = 10 * 3600 // 10:00:00
  const deltaSec = Math.floor(offsetMs / 1000)
  const totalSec = ((baseSec + deltaSec) % 86400 + 86400) % 86400
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatClockWithMs(offsetMs: number): string {
  const clock = formatClock(offsetMs)
  const ms = Math.floor(((offsetMs % 1000) + 1000) % 1000)
  return `${clock}.${String(ms).padStart(3, '0')}`
}

export function formatOffset(offsetMs: number): string {
  const sign = offsetMs < 0 ? '-' : '+'
  const secs = Math.abs(offsetMs) / 1000
  return `${sign}${secs.toFixed(3)} s`
}

export function formatInt(n: number): string {
  return INT_FMT.format(Math.round(n))
}

export function statusLabel(outcome: {
  status: FinalStatus
  seat?: string
  wl?: number
}): string {
  switch (outcome.status) {
    case 'CNF':
      return `CNF ${outcome.seat ?? ''}`.trim()
    case 'WL':
      return `WL ${outcome.wl ?? ''}`.trim()
    case 'REGRET':
      return 'REGRET'
    case 'FAILED_429':
      return 'FAILED: 429 Too Many Requests'
    case 'FAILED_TIMEOUT':
      return 'FAILED: Session timed out'
    case 'FAILED_QUEUE_FULL':
      return 'FAILED: Service unavailable'
  }
}

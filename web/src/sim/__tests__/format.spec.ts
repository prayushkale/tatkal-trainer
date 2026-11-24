import { describe, expect, it } from 'vitest'
import { formatClock, formatInt, formatOffset, statusLabel } from '../format.ts'

describe('format', () => {
  it('formats countdown and post-open clock strings around 10:00:00', () => {
    expect(formatClock(-2000)).toBe('09:59:58')
    expect(formatClock(-1)).toBe('09:59:59')
    expect(formatClock(0)).toBe('10:00:00')
    expect(formatClock(312)).toBe('10:00:00')
    expect(formatClock(1000)).toBe('10:00:01')
    expect(formatClock(65_000)).toBe('10:01:05')
  })

  it('formats millisecond offset in seconds with 3 decimals', () => {
    expect(formatOffset(312)).toBe('+0.312 s')
    expect(formatOffset(0)).toBe('+0.000 s')
    expect(formatOffset(1250)).toBe('+1.250 s')
  })

  it('formats integers with en-US grouping', () => {
    expect(formatInt(50001)).toBe('50,001')
    expect(formatInt(1500)).toBe('1,500')
    expect(formatInt(128)).toBe('128')
  })

  it('formats user outcomes to stamp labels', () => {
    expect(statusLabel({ status: 'WL', wl: 347 })).toBe('WL 347')
    expect(statusLabel({ status: 'FAILED_429' })).toBe('FAILED: 429 Too Many Requests')
    expect(statusLabel({ status: 'FAILED_TIMEOUT' })).toBe('FAILED: Session timed out')
    expect(statusLabel({ status: 'FAILED_QUEUE_FULL' })).toBe('FAILED: Service unavailable')
    expect(statusLabel({ status: 'REGRET' })).toBe('REGRET')
    expect(statusLabel({ status: 'CNF', seat: 'B2/34' })).toBe('CNF B2/34')
  })
})

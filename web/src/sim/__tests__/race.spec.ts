import { describe, expect, it } from 'vitest'
import { DEFAULTS } from '../defaults.ts'
import { runRace } from '../race.ts'
import type { FinalStatus, SimConfig } from '../types.ts'

function cfgWith(overrides: Partial<SimConfig>): SimConfig {
  return { ...DEFAULTS, retryJitterMs: 0, ...overrides }
}

describe('runRace', () => {
  it('is deterministic for the same config, seed, and userDelayMs', () => {
    const cfg = cfgWith({ bots: 2000 })
    const a = runRace(cfg, 42, 300)
    const b = runRace(cfg, 42, 300)
    expect(a.user).toEqual(b.user)
    expect(a.totals).toEqual(b.totals)
    expect(a.fcfsScore).toBe(b.fcfsScore)
    expect(a.userRankByClick).toBe(b.userRankByClick)
  })

  it('conserves total requests across all final statuses at defaults', () => {
    const res = runRace(DEFAULTS, 7, 300)
    const statuses: FinalStatus[] = [
      'CNF',
      'WL',
      'REGRET',
      'FAILED_429',
      'FAILED_QUEUE_FULL',
      'FAILED_TIMEOUT',
    ]
    const total = statuses.reduce((sum, s) => sum + res.totals.byStatus[s], 0)
    expect(total).toBe(DEFAULTS.bots + 1)
    expect(res.fcfsScore).toBeGreaterThanOrEqual(0)
    expect(res.fcfsScore).toBeLessThanOrEqual(1)
  })

  it('enforces seat uniqueness and sequential waitlist numbers', () => {
    const cfg = cfgWith({ bots: 2500, seats: 64, waitlistCap: 120 })
    const res = runRace(cfg, 19, 250, { inspect: true })
    expect(res.inspected).toBeDefined()
    const { seats, wls } = res.inspected!

    expect(seats.length).toBe(res.totals.byStatus.CNF)
    expect(seats.length).toBeLessThanOrEqual(cfg.seats)
    expect(new Set(seats).size).toBe(seats.length)

    expect(wls.length).toBe(res.totals.byStatus.WL)
    expect(wls.length).toBeLessThanOrEqual(cfg.waitlistCap)
    const sortedWls = [...wls].sort((a, b) => a - b)
    for (let i = 0; i < sortedWls.length; i++) {
      expect(sortedWls[i]).toBe(i + 1)
    }
  })

  it('gives user CNF B1/1 with blame none when there are 0 bots', () => {
    const res = runRace(cfgWith({ bots: 0 }), 1, 100)
    expect(res.user.status).toBe('CNF')
    expect(res.user.seat).toBe('B1/1')
    expect(res.user.blame).toBe('none')
    expect(res.user.attempts).toBe(1)
    expect(res.user.rateLimitedTimes).toBe(0)
  })

  it('gives user WL 1 with blame lock when there are 0 bots and 0 seats', () => {
    const res = runRace(cfgWith({ bots: 0, seats: 0 }), 1, 100)
    expect(res.user.status).toBe('WL')
    expect(res.user.wl).toBe(1)
    expect(res.user.blame).toBe('lock')
  })

  it('ends FAILED_429 with 3 attempts and blame bucket when bucket is exhausted', () => {
    const cfg = cfgWith({
      bots: 10,
      rateLimitPerSec: 0.001,
      burstSeconds: 1000,
      fastShare: 1,
      fastMeanMs: 1,
      botLatencyMinMs: 1,
      botLatencyMaxMs: 1,
      userLatencyMs: 50,
      maxRetries: 2,
      retryBackoffMs: 100,
    })
    const res = runRace(cfg, 1, 500)
    expect(res.user.status).toBe('FAILED_429')
    expect(res.user.attempts).toBe(3)
    expect(res.user.rateLimitedTimes).toBe(3)
    expect(res.user.blame).toBe('bucket')
  })

  it('blames bucket when user is rate-limited once and then lands WL 2 on retry', () => {
    const cfg = cfgWith({
      bots: 1,
      seats: 0,
      rateLimitPerSec: 10,
      burstSeconds: 0.1,
      fastShare: 1,
      fastMeanMs: 0,
      botLatencyMinMs: 10,
      botLatencyMaxMs: 10,
      userLatencyMs: 20,
      maxRetries: 2,
      retryBackoffMs: 100,
    })
    const res = runRace(cfg, 1, 0)
    expect(res.user.status).toBe('WL')
    expect(res.user.wl).toBe(2)
    expect(res.user.blame).toBe('bucket')
    expect(res.user.attempts).toBe(2)
    expect(res.user.rateLimitedTimes).toBe(1)
  })

  it('ends FAILED_QUEUE_FULL with blame queue when workers are busy and queueSize is 0', () => {
    const cfg = cfgWith({
      bots: 1,
      workers: 1,
      serviceMs: 10_000,
      queueSize: 0,
      rateLimitPerSec: 10_000,
      burstSeconds: 1,
      fastShare: 1,
      fastMeanMs: 0,
      botLatencyMinMs: 10,
      botLatencyMaxMs: 10,
      userLatencyMs: 20,
    })
    const res = runRace(cfg, 1, 0)
    expect(res.user.status).toBe('FAILED_QUEUE_FULL')
    expect(res.user.blame).toBe('queue')
  })

  it('ends FAILED_TIMEOUT with blame queue when wait exceeds queueTimeoutMs', () => {
    const cfg = cfgWith({
      bots: 2,
      workers: 1,
      serviceMs: 3000,
      queueSize: 10,
      queueTimeoutMs: 1000,
      rateLimitPerSec: 10_000,
      burstSeconds: 1,
      fastShare: 1,
      fastMeanMs: 0,
      botLatencyMinMs: 10,
      botLatencyMaxMs: 10,
      userLatencyMs: 50,
    })
    const res = runRace(cfg, 1, 0)
    expect(res.user.status).toBe('FAILED_TIMEOUT')
    expect(res.user.blame).toBe('queue')
  })

  it('throws RangeError when userDelayMs is negative', () => {
    expect(() => runRace(DEFAULTS, 1, -5)).toThrow(RangeError)
  })

  it('computes fcfsScore = 1 when capacity is unconstrained and latencies match', () => {
    const cfg = cfgWith({
      bots: 50,
      seats: 50,
      rateLimitPerSec: 100_000,
      burstSeconds: 1,
      queueSize: 10_000,
      workers: 64,
      serviceMs: 1,
      botLatencyMinMs: 20,
      botLatencyMaxMs: 20,
      userLatencyMs: 20,
    })
    const res = runRace(cfg, 42, 100)
    expect(res.fcfsScore).toBe(1)
  })
})

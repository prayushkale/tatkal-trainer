import { describe, expect, it } from 'vitest'
import { expo, mulberry32 } from '../rng.ts'

describe('rng', () => {
  it('mulberry32(42) produces identical sequences on repeat calls', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('seeds 42 and 43 produce different sequences', () => {
    const a = mulberry32(42)
    const b = mulberry32(43)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('every generated value is in [0, 1)', () => {
    const rand = mulberry32(123456)
    for (let i = 0; i < 10_000; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('expo produces non-negative finite numbers around the mean', () => {
    const rand = mulberry32(99)
    let sum = 0
    const count = 2000
    for (let i = 0; i < count; i++) {
      const v = expo(rand, 100)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      sum += v
    }
    const avg = sum / count
    expect(avg).toBeGreaterThan(85)
    expect(avg).toBeLessThan(115)
  })
})

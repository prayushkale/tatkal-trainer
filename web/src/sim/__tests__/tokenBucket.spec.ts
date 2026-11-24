import { describe, expect, it } from 'vitest'
import { TokenBucket } from '../tokenBucket.ts'

describe('TokenBucket', () => {
  it('allows up to capacity at zero refill rate and rejects the next', () => {
    const bucket = new TokenBucket(5, 0, 0)
    for (let i = 0; i < 5; i++) {
      expect(bucket.take(0)).toBe(true)
    }
    expect(bucket.take(0)).toBe(false)
    expect(bucket.level()).toBe(0)
  })

  it('refills linearly at refillPerSec', () => {
    const bucket = new TokenBucket(5, 10, 0)
    for (let i = 0; i < 5; i++) {
      expect(bucket.take(0)).toBe(true)
    }
    expect(bucket.take(50)).toBe(false)
    expect(bucket.take(100)).toBe(true)
    expect(bucket.take(100)).toBe(false)
  })

  it('caps refill at capacity even after a long idle period', () => {
    const bucket = new TokenBucket(5, 10, 0)
    for (let i = 0; i < 5; i++) {
      expect(bucket.take(0)).toBe(true)
    }
    expect(bucket.take(1_000_000)).toBe(true)
    for (let i = 0; i < 4; i++) {
      expect(bucket.take(1_000_000)).toBe(true)
    }
    expect(bucket.take(1_000_000)).toBe(false)
  })
})

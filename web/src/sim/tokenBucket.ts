export class TokenBucket {
  private tokens: number
  private ts: number

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    nowMs = 0,
  ) {
    this.tokens = capacity
    this.ts = nowMs
  }

  take(nowMs: number): boolean {
    const elapsed = nowMs - this.ts
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + (elapsed * this.refillPerSec) / 1000)
      this.ts = nowMs
    }
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  level(): number {
    return this.tokens
  }
}

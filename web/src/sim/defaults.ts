import type { SimConfig } from './types.ts'

export const DEFAULTS: SimConfig = {
  bots: 50_000,
  seats: 128,
  waitlistCap: 1500,
  lbNodes: 4,
  lbMs: 2,
  rateLimitPerSec: 1500,
  burstSeconds: 0.25,
  queueSize: 1000,
  queueTimeoutMs: 2500,
  workers: 8,
  serviceMs: 10,
  fastShare: 0.85,
  fastMeanMs: 14_000,
  slowMeanMs: 150_000,
  botLatencyMinMs: 15,
  botLatencyMaxMs: 80,
  userLatencyMs: 90,
  maxRetries: 2,
  retryBackoffMs: 25,
  retryJitterMs: 30,
}

export const SLIDERS = {
  rateLimit: { min: 100, max: 20_000 },
  queueSize: { min: 10, max: 50_000 },
} as const

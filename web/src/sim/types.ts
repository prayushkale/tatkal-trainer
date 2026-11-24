export type FinalStatus =
  | 'CNF'
  | 'WL'
  | 'REGRET'
  | 'FAILED_429'
  | 'FAILED_QUEUE_FULL'
  | 'FAILED_TIMEOUT'

export type Stage = 'lb' | 'bucket' | 'queue' | 'lock'

export type Blame = 'none' | 'bucket' | 'queue' | 'lock'

export interface SimConfig {
  bots: number
  seats: number
  waitlistCap: number
  lbNodes: number
  lbMs: number
  rateLimitPerSec: number
  burstSeconds: number
  queueSize: number
  queueTimeoutMs: number
  workers: number
  serviceMs: number
  fastShare: number
  fastMeanMs: number
  slowMeanMs: number
  botLatencyMinMs: number
  botLatencyMaxMs: number
  userLatencyMs: number
  maxRetries: number
  retryBackoffMs: number
  retryJitterMs: number
}

export interface UserOutcome {
  status: FinalStatus
  seat?: string
  wl?: number
  blame: Blame
  attempts: number
  rateLimitedTimes: number
}

export interface StageSpan {
  stage: 'network' | Stage
  ms: number
}

export interface ParticleTrack {
  id: number
  isUser: boolean
  events: { t: number; at: Stage | 'out'; outcome?: FinalStatus }[]
}

export interface RaceTotals {
  byStatus: Record<FinalStatus, number>
  tokensGranted: number
  peakQueue: number
  seatsGoneAtMs: number | null
  waitlistClosedAtMs: number | null
}

export interface RaceResult {
  seed: number
  userDelayMs: number
  user: UserOutcome
  timeline: StageSpan[]
  totals: RaceTotals
  tracks: ParticleTrack[]
  fcfsScore: number
  userRankByClick: number
}

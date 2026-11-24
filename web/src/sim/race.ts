import { EventHeap } from './heap.ts'
import { expo, mulberry32 } from './rng.ts'
import { TokenBucket } from './tokenBucket.ts'
import type {
  Blame,
  FinalStatus,
  ParticleTrack,
  RaceResult,
  SimConfig,
  Stage,
  StageSpan,
} from './types.ts'

export interface RunRaceOptions {
  inspect?: boolean
}

export interface RaceResultWithInspect extends RaceResult {
  inspected?: {
    seats: string[]
    wls: number[]
  }
}

const STATUS_CNF = 1
const STATUS_WL = 2
const STATUS_REGRET = 3
const STATUS_429 = 4
const STATUS_QUEUE_FULL = 5
const STATUS_TIMEOUT = 6

const CODE_TO_STATUS: Record<number, FinalStatus> = {
  [STATUS_CNF]: 'CNF',
  [STATUS_WL]: 'WL',
  [STATUS_REGRET]: 'REGRET',
  [STATUS_429]: 'FAILED_429',
  [STATUS_QUEUE_FULL]: 'FAILED_QUEUE_FULL',
  [STATUS_TIMEOUT]: 'FAILED_TIMEOUT',
}

function seatLabel(index: number): string {
  const coach = Math.floor(index / 64) + 1
  const berth = (index % 64) + 1
  return `B${coach}/${berth}`
}

function computeFcfsScore(
  clickAt: Float64Array,
  finalCode: Uint8Array,
  seats: number,
  n: number,
): number {
  const k = Math.min(seats, n)
  if (k <= 0) return 1

  // Maintain a max-heap of size k on clickAt to find the earliest k clickers in O(n log k)
  const heapIds = new Int32Array(k)
  const heapTimes = new Float64Array(k)
  let size = 0

  const swap = (a: number, b: number) => {
    const ti = heapIds[a]!
    heapIds[a] = heapIds[b]!
    heapIds[b] = ti
    const tt = heapTimes[a]!
    heapTimes[a] = heapTimes[b]!
    heapTimes[b] = tt
  }

  const greater = (a: number, b: number) => {
    if (heapTimes[a]! !== heapTimes[b]!) return heapTimes[a]! > heapTimes[b]!
    return heapIds[a]! > heapIds[b]!
  }

  for (let i = 0; i < n; i++) {
    const t = clickAt[i]!
    if (size < k) {
      let idx = size++
      heapIds[idx] = i
      heapTimes[idx] = t
      while (idx > 0) {
        const parent = (idx - 1) >> 1
        if (!greater(idx, parent)) break
        swap(idx, parent)
        idx = parent
      }
    } else if (t < heapTimes[0]! || (t === heapTimes[0]! && i < heapIds[0]!)) {
      heapIds[0] = i
      heapTimes[0] = t
      let idx = 0
      while (true) {
        const left = idx * 2 + 1
        const right = left + 1
        let largest = idx
        if (left < k && greater(left, largest)) largest = left
        if (right < k && greater(right, largest)) largest = right
        if (largest === idx) break
        swap(idx, largest)
        idx = largest
      }
    }
  }

  let cnfCount = 0
  for (let i = 0; i < k; i++) {
    if (finalCode[heapIds[i]!] === STATUS_CNF) {
      cnfCount++
    }
  }
  return cnfCount / k
}

export function runRace(
  cfg: SimConfig,
  seed: number,
  userDelayMs: number,
  options?: RunRaceOptions,
): RaceResultWithInspect {
  if (userDelayMs < 0) {
    throw new RangeError('booking not open yet')
  }

  const rand = mulberry32(seed)
  const n = cfg.bots + 1
  const clickAt = new Float64Array(n)
  const lat = new Float64Array(n)
  const retries = new Uint8Array(n)
  const rl = new Uint8Array(n)
  const finalCode = new Uint8Array(n)

  clickAt[0] = userDelayMs
  lat[0] = cfg.userLatencyMs

  const latSpan = cfg.botLatencyMaxMs - cfg.botLatencyMinMs
  let userRankByClick = 1
  for (let i = 1; i < n; i++) {
    const c = rand() < cfg.fastShare ? expo(rand, cfg.fastMeanMs) : expo(rand, cfg.slowMeanMs)
    clickAt[i] = c
    lat[i] = cfg.botLatencyMinMs + rand() * latSpan
    if (c < userDelayMs) {
      userRankByClick++
    }
  }

  // Sample up to 400 bot ids plus user (id 0) for particle tracks
  const trackMap = new Map<number, ParticleTrack>()
  const makeTrack = (id: number): ParticleTrack => ({
    id,
    isUser: id === 0,
    events: [],
  })
  trackMap.set(0, makeTrack(0))

  const sampleTarget = Math.min(400, cfg.bots)
  if (cfg.bots <= 400) {
    for (let i = 1; i <= cfg.bots; i++) {
      trackMap.set(i, makeTrack(i))
    }
  } else {
    let sampled = 0
    while (sampled < sampleTarget) {
      const pick = 1 + Math.floor(rand() * cfg.bots)
      if (!trackMap.has(pick)) {
        trackMap.set(pick, makeTrack(pick))
        sampled++
      }
    }
  }

  const recordTrack = (id: number, t: number, at: Stage | 'out', outcome?: FinalStatus) => {
    const tr = trackMap.get(id)
    if (!tr) return
    if (outcome !== undefined) {
      tr.events.push({ t, at, outcome })
    } else {
      tr.events.push({ t, at })
    }
  }

  const heap = new EventHeap<number>()
  for (let i = 0; i < n; i++) {
    const arriveT = clickAt[i]! + lat[i]! + cfg.lbMs
    // eventCode: (id * 2) + kind, where kind 0 = ARRIVE, kind 1 = DONE
    heap.push(arriveT, i * 2)
  }

  const capacity = cfg.rateLimitPerSec * cfg.burstSeconds
  const bucket = new TokenBucket(capacity, cfg.rateLimitPerSec, 0)

  const qCap = Math.max(1, cfg.queueSize)
  const qIds = new Int32Array(qCap)
  const qEnq = new Float64Array(qCap)
  let qHead = 0
  let qTail = 0
  let qLen = 0
  let peakQueue = 0

  let freeWorkers = cfg.workers
  let seatsUsed = 0
  let wlCount = 0
  let tokensGranted = 0
  let seatsGoneAtMs: number | null = null
  let waitlistClosedAtMs: number | null = null

  let userSeat: string | undefined
  let userWl: number | undefined

  const firstArriveUserT = clickAt[0]! + lat[0]! + cfg.lbMs
  let tokenGotUserT: number | null = null
  let lastArriveUserT = firstArriveUserT
  let userEnqT: number | null = null
  let userStartT: number | null = null
  let userTimeoutT: number | null = null
  let userReachedLock = false

  const inspectedSeats: string[] | null = options?.inspect ? [] : null
  const inspectedWls: number[] | null = options?.inspect ? [] : null

  const byStatus: Record<FinalStatus, number> = {
    CNF: 0,
    WL: 0,
    REGRET: 0,
    FAILED_429: 0,
    FAILED_QUEUE_FULL: 0,
    FAILED_TIMEOUT: 0,
  }

  const startWork = (id: number, t: number) => {
    freeWorkers--
    if (id === 0) {
      userStartT = t
      userReachedLock = true
    }
    recordTrack(id, t, 'lock')
    heap.push(t + cfg.serviceMs, id * 2 + 1)
  }

  const drain = (t: number) => {
    while (freeWorkers > 0 && qLen > 0) {
      const id = qIds[qHead]!
      const enq = qEnq[qHead]!
      qHead = (qHead + 1) % qCap
      qLen--

      if (t - enq > cfg.queueTimeoutMs) {
        finalCode[id] = STATUS_TIMEOUT
        byStatus.FAILED_TIMEOUT++
        if (id === 0) {
          userTimeoutT = t
        }
        recordTrack(id, t, 'out', 'FAILED_TIMEOUT')
        continue
      }
      startWork(id, t)
    }
  }

  while (heap.size > 0) {
    const ev = heap.pop()!
    const t = ev.t
    const code = ev.item
    const kind = code & 1
    const id = code >>> 1

    if (kind === 0) {
      // ARRIVE
      if (id === 0) {
        lastArriveUserT = t
      }
      const lbT = Math.max(0, t - cfg.lbMs)
      recordTrack(id, lbT, 'lb')
      recordTrack(id, t, 'bucket')

      if (!bucket.take(t)) {
        rl[id] = rl[id]! + 1
        if (retries[id]! < cfg.maxRetries) {
          retries[id] = retries[id]! + 1
          const nextT =
            t +
            2 * lat[id]! +
            cfg.retryBackoffMs * retries[id]! +
            (cfg.retryJitterMs > 0 ? rand() * cfg.retryJitterMs : 0)
          heap.push(nextT, id * 2)
        } else {
          finalCode[id] = STATUS_429
          byStatus.FAILED_429++
          recordTrack(id, t, 'out', 'FAILED_429')
        }
      } else {
        tokensGranted++
        if (id === 0) {
          tokenGotUserT = t
        }
        if (freeWorkers > 0) {
          if (id === 0) {
            userEnqT = t
          }
          startWork(id, t)
        } else if (qLen >= cfg.queueSize) {
          finalCode[id] = STATUS_QUEUE_FULL
          byStatus.FAILED_QUEUE_FULL++
          recordTrack(id, t, 'queue')
          recordTrack(id, t, 'out', 'FAILED_QUEUE_FULL')
        } else {
          qIds[qTail] = id
          qEnq[qTail] = t
          qTail = (qTail + 1) % qCap
          qLen++
          if (qLen > peakQueue) peakQueue = qLen
          if (id === 0) {
            userEnqT = t
          }
          recordTrack(id, t, 'queue')
        }
      }
    } else {
      // DONE
      let outcome: FinalStatus
      if (seatsUsed < cfg.seats) {
        const label = seatLabel(seatsUsed)
        seatsUsed++
        finalCode[id] = STATUS_CNF
        byStatus.CNF++
        outcome = 'CNF'
        if (id === 0) userSeat = label
        if (inspectedSeats) inspectedSeats.push(label)
        if (seatsUsed === cfg.seats) seatsGoneAtMs = t
      } else if (wlCount < cfg.waitlistCap) {
        wlCount++
        finalCode[id] = STATUS_WL
        byStatus.WL++
        outcome = 'WL'
        if (id === 0) userWl = wlCount
        if (inspectedWls) inspectedWls.push(wlCount)
        if (wlCount === cfg.waitlistCap) waitlistClosedAtMs = t
      } else {
        finalCode[id] = STATUS_REGRET
        byStatus.REGRET++
        outcome = 'REGRET'
      }

      recordTrack(id, t, 'out', outcome)
      freeWorkers++
      drain(t)
    }
  }

  const userStatus = CODE_TO_STATUS[finalCode[0]!]!
  let blame: Blame
  if (userStatus === 'CNF') {
    blame = 'none'
  } else if (rl[0]! > 0 || userStatus === 'FAILED_429') {
    blame = 'bucket'
  } else if (userStatus === 'FAILED_QUEUE_FULL' || userStatus === 'FAILED_TIMEOUT') {
    blame = 'queue'
  } else {
    blame = 'lock'
  }

  const networkMs = 2 * cfg.userLatencyMs + cfg.lbMs
  const bucketMs =
    tokenGotUserT !== null
      ? Math.max(0, tokenGotUserT - firstArriveUserT)
      : Math.max(0, lastArriveUserT - firstArriveUserT)
  const queueMs =
    userEnqT !== null && userStartT !== null
      ? Math.max(0, userStartT - userEnqT)
      : userEnqT !== null && userTimeoutT !== null
        ? Math.max(0, userTimeoutT - userEnqT)
        : 0
  const lockMs = userReachedLock ? cfg.serviceMs : 0

  const timeline: StageSpan[] = [
    { stage: 'network', ms: Math.round(networkMs) },
    { stage: 'bucket', ms: Math.round(bucketMs) },
    { stage: 'queue', ms: Math.round(queueMs) },
    { stage: 'lock', ms: Math.round(lockMs) },
  ]

  const fcfsScore = computeFcfsScore(clickAt, finalCode, cfg.seats, n)

  const result: RaceResultWithInspect = {
    seed,
    userDelayMs,
    user: {
      status: userStatus,
      ...(userSeat !== undefined ? { seat: userSeat } : {}),
      ...(userWl !== undefined ? { wl: userWl } : {}),
      blame,
      attempts: retries[0]! + 1,
      rateLimitedTimes: rl[0]!,
    },
    timeline,
    totals: {
      byStatus,
      tokensGranted,
      peakQueue,
      seatsGoneAtMs,
      waitlistClosedAtMs,
    },
    tracks: Array.from(trackMap.values()),
    fcfsScore,
    userRankByClick,
  }

  if (options?.inspect) {
    result.inspected = {
      seats: inspectedSeats!,
      wls: inspectedWls!,
    }
  }

  return result
}

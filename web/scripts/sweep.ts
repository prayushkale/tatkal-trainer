import { DEFAULTS } from '../src/sim/defaults.ts'
import { formatInt } from '../src/sim/format.ts'
import { runRace } from '../src/sim/race.ts'
import type { Blame, FinalStatus, SimConfig } from '../src/sim/types.ts'

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function topBlame(counts: Record<Blame, number>): string {
  let best: Blame = 'none'
  let bestN = -1
  for (const [k, v] of Object.entries(counts) as [Blame, number][]) {
    if (v > bestN) {
      bestN = v
      best = k
    }
  }
  return `${best} (${bestN})`
}

function runDelaySweep(cfg: SimConfig) {
  const delays = [100, 200, 300, 400, 600, 1000, 2000]
  const seeds = 50

  console.log('### Delay sweep (seeds 1..50 at DEFAULTS)')
  console.log(
    '| Delay (ms) | CNF | WL | REGRET | 429 | QFull | Timeout | Med WL | Top Blame | Med SeatsGone (ms) | Med FCFS |',
  )
  console.log(
    '|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|',
  )

  for (const delay of delays) {
    const statusCounts: Record<FinalStatus, number> = {
      CNF: 0,
      WL: 0,
      REGRET: 0,
      FAILED_429: 0,
      FAILED_QUEUE_FULL: 0,
      FAILED_TIMEOUT: 0,
    }
    const blameCounts: Record<Blame, number> = {
      none: 0,
      bucket: 0,
      queue: 0,
      lock: 0,
    }
    const wls: number[] = []
    const seatsGone: number[] = []
    const fcfs: number[] = []

    for (let seed = 1; seed <= seeds; seed++) {
      const res = runRace(cfg, seed, delay)
      statusCounts[res.user.status]++
      blameCounts[res.user.blame]++
      if (res.user.status === 'WL' && res.user.wl !== undefined) {
        wls.push(res.user.wl)
      }
      if (res.totals.seatsGoneAtMs !== null) {
        seatsGone.push(res.totals.seatsGoneAtMs)
      }
      fcfs.push(res.fcfsScore)
    }

    const medWl = median(wls)
    const medGone = median(seatsGone)
    const medFcfs = median(fcfs)

    console.log(
      `| ${delay} | ${statusCounts.CNF} | ${statusCounts.WL} | ${statusCounts.REGRET} | ${statusCounts.FAILED_429} | ${statusCounts.FAILED_QUEUE_FULL} | ${statusCounts.FAILED_TIMEOUT} | ${medWl !== null ? medWl.toFixed(0) : '-'} | ${topBlame(blameCounts)} | ${medGone !== null ? medGone.toFixed(0) : '-'} | ${medFcfs !== null ? (medFcfs * 100).toFixed(1) + '%' : '-'} |`,
    )
  }
}

function runFairSweep(cfg: SimConfig) {
  const rateLimits = [200, 500, 800, 1500, 5000, 20000]
  const queueSizes = [10, 100, 1000, 10000, 50000]
  const seeds = 20
  const userDelay = 300
  const totalReq = cfg.bots + 1

  console.log('### Fairness grid (seeds 1..20, userDelay 300 ms)')
  console.log('| Rate (req/s) | Queue | Med FCFS | Med Failed Share | Med Failed Count |')
  console.log('|---:|---:|---:|---:|---:|')

  for (const rateLimitPerSec of rateLimits) {
    for (const queueSize of queueSizes) {
      const testCfg: SimConfig = { ...cfg, rateLimitPerSec, queueSize }
      const fcfsList: number[] = []
      const failShares: number[] = []
      const failCounts: number[] = []

      for (let seed = 1; seed <= seeds; seed++) {
        const res = runRace(testCfg, seed, userDelay)
        fcfsList.push(res.fcfsScore)
        const failed =
          res.totals.byStatus.FAILED_429 +
          res.totals.byStatus.FAILED_QUEUE_FULL +
          res.totals.byStatus.FAILED_TIMEOUT
        failCounts.push(failed)
        failShares.push(failed / totalReq)
      }

      const medFcfs = median(fcfsList) ?? 0
      const medFailShare = median(failShares) ?? 0
      const medFailCount = median(failCounts) ?? 0

      console.log(
        `| ${formatInt(rateLimitPerSec)} | ${formatInt(queueSize)} | ${(medFcfs * 100).toFixed(1)}% | ${(medFailShare * 100).toFixed(1)}% | ${formatInt(medFailCount)} |`,
      )
    }
  }
}

interface WindowHit {
  seed: number
  start: number
  end: number
  width: number
}

function findBestWindowForSeed(
  cfg: SimConfig,
  seed: number,
  targetWl: number,
  minDelay: number,
  maxDelay: number,
): WindowHit | null {
  // Coarse stride first to spot neighborhoods near targetWl, then exact 1ms scan around hits
  const stride = 5
  const probeDelays: number[] = []
  for (let d = minDelay; d <= maxDelay; d += stride) {
    probeDelays.push(d)
  }

  const candidateCenters = new Set<number>()
  let prevWl: number | null = null
  for (const d of probeDelays) {
    const res = runRace(cfg, seed, d)
    const wl = res.user.status === 'WL' ? (res.user.wl ?? null) : null
    if (
      wl !== null &&
      (Math.abs(wl - targetWl) <= 25 ||
        (prevWl !== null &&
          ((prevWl <= targetWl && wl >= targetWl) || (prevWl >= targetWl && wl <= targetWl))))
    ) {
      candidateCenters.add(d)
    }
    prevWl = wl
  }

  if (candidateCenters.size === 0) return null

  const tested = new Map<number, boolean>()
  const check = (d: number): boolean => {
    if (d < minDelay || d > maxDelay) return false
    const cached = tested.get(d)
    if (cached !== undefined) return cached
    const res = runRace(cfg, seed, d)
    const ok = res.user.status === 'WL' && res.user.wl === targetWl && res.user.blame === 'bucket'
    tested.set(d, ok)
    return ok
  }

  const toScan = new Set<number>()
  for (const c of candidateCenters) {
    for (let d = Math.max(minDelay, c - 12); d <= Math.min(maxDelay, c + 12); d++) {
      toScan.add(d)
    }
  }

  const sortedDelays = [...toScan].sort((a, b) => a - b)
  let best: WindowHit | null = null
  let curStart: number | null = null
  let curEnd = -1

  for (const d of sortedDelays) {
    const ok = check(d)
    if (ok) {
      if (curStart === null) {
        curStart = d
        curEnd = d
        // Expand left if boundary hit
        while (curStart > minDelay && check(curStart - 1)) {
          curStart--
        }
      } else if (d === curEnd + 1) {
        curEnd = d
      } else {
        // Close previous
        const width = curEnd - curStart + 1
        if (!best || width > best.width) {
          best = { seed, start: curStart, end: curEnd, width }
        }
        curStart = d
        curEnd = d
      }
      // Expand right if at end of current scan patch
      while (curEnd < maxDelay && !toScan.has(curEnd + 1) && check(curEnd + 1)) {
        curEnd++
      }
    } else if (curStart !== null) {
      const width = curEnd - curStart + 1
      if (!best || width > best.width) {
        best = { seed, start: curStart, end: curEnd, width }
      }
      curStart = null
    }
  }

  if (curStart !== null) {
    const width = curEnd - curStart + 1
    if (!best || width > best.width) {
      best = { seed, start: curStart, end: curEnd, width }
    }
  }

  return best
}

function runFindWl(cfg: SimConfig, targetWl: number, maxSeeds: number) {
  const hits: WindowHit[] = []
  for (let seed = 1; seed <= maxSeeds; seed++) {
    const hit = findBestWindowForSeed(cfg, seed, targetWl, 200, 500)
    if (hit) hits.push(hit)
  }

  hits.sort((a, b) => b.width - a.width || a.seed - b.seed)
  const top = hits.slice(0, 10)

  console.log(`### Widest WL ${targetWl} (blame=bucket) windows across seeds 1..${maxSeeds} (delay 200..500 ms)`)
  console.log('| Rank | Seed | Window (ms) | Width (ms) |')
  console.log('|---:|---:|---|---:|')
  top.forEach((h, i) => {
    console.log(`| ${i + 1} | ${h.seed} | +${h.start} to +${h.end} | ${h.width} |`)
  })
}

const args = process.argv.slice(2)
const findIdx = args.indexOf('--find-wl')
if (findIdx !== -1) {
  const target = Number(args[findIdx + 1] ?? 347)
  const seedsIdx = args.indexOf('--seeds')
  const maxSeeds = seedsIdx !== -1 ? Number(args[seedsIdx + 1]) : 2000
  runFindWl(DEFAULTS, target, maxSeeds)
} else if (args.includes('--fair')) {
  runFairSweep(DEFAULTS)
} else {
  runDelaySweep(DEFAULTS)
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function expo(rand: () => number, mean: number): number {
  let u = rand()
  if (u >= 1) u = 1 - Number.EPSILON
  return -Math.log(1 - u) * mean
}

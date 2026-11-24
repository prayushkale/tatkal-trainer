export interface HeapEntry<T> {
  t: number
  item: T
}

export class EventHeap<T> {
  private times: number[] = []
  private seqs: number[] = []
  private items: T[] = []
  private nextSeq = 0

  get size(): number {
    return this.times.length
  }

  push(t: number, item: T): void {
    const idx = this.times.length
    this.times.push(t)
    this.seqs.push(this.nextSeq++)
    this.items.push(item)
    this.siftUp(idx)
  }

  pop(): HeapEntry<T> | undefined {
    const n = this.times.length
    if (n === 0) return undefined

    const topT = this.times[0]!
    const topItem = this.items[0]!

    const lastT = this.times.pop()!
    const lastSeq = this.seqs.pop()!
    const lastItem = this.items.pop()!

    if (n > 1) {
      this.times[0] = lastT
      this.seqs[0] = lastSeq
      this.items[0] = lastItem
      this.siftDown(0)
    }

    return { t: topT, item: topItem }
  }

  private less(i: number, j: number): boolean {
    const ti = this.times[i]!
    const tj = this.times[j]!
    if (ti !== tj) return ti < tj
    return this.seqs[i]! < this.seqs[j]!
  }

  private swap(i: number, j: number): void {
    const tmpT = this.times[i]!
    this.times[i] = this.times[j]!
    this.times[j] = tmpT

    const tmpS = this.seqs[i]!
    this.seqs[i] = this.seqs[j]!
    this.seqs[j] = tmpS

    const tmpItem = this.items[i]!
    this.items[i] = this.items[j]!
    this.items[j] = tmpItem
  }

  private siftUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1
      if (!this.less(idx, parent)) break
      this.swap(idx, parent)
      idx = parent
    }
  }

  private siftDown(idx: number): void {
    const n = this.times.length
    while (true) {
      const left = idx * 2 + 1
      const right = left + 1
      let smallest = idx

      if (left < n && this.less(left, smallest)) smallest = left
      if (right < n && this.less(right, smallest)) smallest = right
      if (smallest === idx) break

      this.swap(idx, smallest)
      idx = smallest
    }
  }
}

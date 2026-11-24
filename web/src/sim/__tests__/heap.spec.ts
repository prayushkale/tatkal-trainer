import { describe, expect, it } from 'vitest'
import { EventHeap } from '../heap.ts'

describe('EventHeap', () => {
  it('pops items in time order and breaks ties by insertion order', () => {
    const heap = new EventHeap<string>()
    heap.push(5, 't5')
    heap.push(1, 't1-first')
    heap.push(3, 't3')
    heap.push(1, 't1-second')

    expect(heap.size).toBe(4)
    expect(heap.pop()).toEqual({ t: 1, item: 't1-first' })
    expect(heap.pop()).toEqual({ t: 1, item: 't1-second' })
    expect(heap.pop()).toEqual({ t: 3, item: 't3' })
    expect(heap.pop()).toEqual({ t: 5, item: 't5' })
    expect(heap.size).toBe(0)
    expect(heap.pop()).toBeUndefined()
  })
})

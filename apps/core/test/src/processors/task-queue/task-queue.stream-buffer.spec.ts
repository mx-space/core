import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskStreamBuffer } from '~/processors/task-queue/task-queue.stream-buffer'
import type { AiTaskUpdateStreamFrame } from '~/processors/task-queue/task-queue.types'

/**
 * Pure-logic verification of TaskStreamBuffer coalescing:
 *   - 200ms idle window — many small chunks coalesce into ONE emit
 *   - 80-char threshold — a single chunk >= 80 chars flushes immediately
 *   - flushAndDispose drains pending buffers
 */
describe('TaskStreamBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function makeBuffer() {
    const frames: AiTaskUpdateStreamFrame[] = []
    const buffer = new TaskStreamBuffer((f) => frames.push(f))
    return { buffer, frames }
  }

  it('coalesces 10 small chunks within 50ms into exactly 1 emit after 200ms idle', () => {
    const { buffer, frames } = makeBuffer()
    for (let i = 0; i < 10; i++) {
      buffer.push('en', undefined, { chunk: 'abcde' })
      vi.advanceTimersByTime(5)
    }
    // accumulated text length so far: 10 * 5 = 50 < 80 ⇒ no flush yet
    expect(frames).toHaveLength(0)

    // advance past the 200ms idle window from the LAST push (last push at t=45)
    vi.advanceTimersByTime(200)
    expect(frames).toHaveLength(1)
    expect(frames[0].chunk).toBe('abcde'.repeat(10))
    expect(frames[0].lang).toBe('en')
  })

  it('single 100-char chunk emits immediately (>= 80-char trigger)', () => {
    const { buffer, frames } = makeBuffer()
    const big = 'x'.repeat(100)
    buffer.push('en', 'seg-1', { chunk: big })
    // synchronous immediate flush — no timer advance required
    expect(frames).toHaveLength(1)
    expect(frames[0].chunk).toBe(big)
    expect(frames[0].segmentId).toBe('seg-1')
  })

  it('flushAndDispose drains pending buffer for partial chunks below threshold', () => {
    const { buffer, frames } = makeBuffer()
    buffer.push('zh', undefined, { chunk: 'ni' })
    buffer.push('zh', undefined, { chunk: 'hao' })
    expect(frames).toHaveLength(0)

    buffer.flushAndDispose()
    expect(frames).toHaveLength(1)
    expect(frames[0].chunk).toBe('nihao')
    // post-dispose push must be a no-op
    buffer.push('zh', undefined, { chunk: 'world' })
    expect(frames).toHaveLength(1)
  })

  it('flushAndDispose is idempotent', () => {
    const { buffer, frames } = makeBuffer()
    buffer.push('en', undefined, { chunk: 'a' })
    buffer.flushAndDispose()
    expect(frames).toHaveLength(1)
    expect(() => buffer.flushAndDispose()).not.toThrow()
    expect(frames).toHaveLength(1)
  })

  it('done frame flushes the bucket immediately even with sub-80-char text', () => {
    const { buffer, frames } = makeBuffer()
    buffer.push('en', 's1', { chunk: 'short' })
    expect(frames).toHaveLength(0)
    buffer.push('en', 's1', { done: true })
    expect(frames).toHaveLength(1)
    expect(frames[0].chunk).toBe('short')
    expect(frames[0].done).toBe(true)
  })
})

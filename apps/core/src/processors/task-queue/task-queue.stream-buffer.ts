import type { AiTaskUpdateStreamFrame } from './task-queue.types'

const STREAM_FLUSH_IDLE_MS = 200
const STREAM_FLUSH_CHAR_THRESHOLD = 80

interface BufferEntry {
  lang?: string
  segmentId?: string
  text: string
  latestPartial?: unknown
  partialPending: boolean
  timer?: NodeJS.Timeout
}

/**
 * Per-task stream coalescer. Multiple `streamPusher` calls per task share one
 * instance and are bucketed by `${lang}:${segmentId ?? '_'}`. A bucket flushes
 * when any of:
 *   - 200ms idle (no new push within the window)
 *   - accumulated `chunk` text exceeds 80 chars
 *   - `done: true` is pushed for the bucket
 *   - `flushAndDispose()` is called (processor finally)
 *
 * The buffer never owns network IO directly — it calls back into the supplied
 * emit closure which is bound to `TaskQueueEmitter.emitStream`.
 */
export class TaskStreamBuffer {
  private readonly buckets = new Map<string, BufferEntry>()
  private disposed = false

  constructor(
    private readonly emit: (frame: AiTaskUpdateStreamFrame) => void,
  ) {}

  push(
    lang: string | undefined,
    segmentId: string | undefined,
    frame: { chunk?: string; partial?: unknown; done?: boolean },
  ): void {
    if (this.disposed) return
    const key = this.bucketKey(lang, segmentId)
    const entry = this.buckets.get(key) ?? {
      lang,
      segmentId,
      text: '',
      partialPending: false,
    }
    if (typeof frame.chunk === 'string' && frame.chunk.length > 0) {
      entry.text += frame.chunk
    }
    if (frame.partial !== undefined) {
      entry.latestPartial = frame.partial
      entry.partialPending = true
    }

    const shouldFlush =
      frame.done === true || entry.text.length >= STREAM_FLUSH_CHAR_THRESHOLD

    this.buckets.set(key, entry)

    if (shouldFlush) {
      this.flushBucket(key, entry, frame.done === true)
      return
    }

    if (!entry.timer) {
      entry.timer = setTimeout(() => {
        const current = this.buckets.get(key)
        if (!current) return
        current.timer = undefined
        this.flushBucket(key, current, false)
      }, STREAM_FLUSH_IDLE_MS)
      if (typeof entry.timer.unref === 'function') entry.timer.unref()
    }
  }

  /**
   * Flush every bucket immediately and prevent further pushes. Idempotent.
   * Always called from the processor finally for both success and error paths.
   */
  flushAndDispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const [key, entry] of this.buckets) {
      this.flushBucket(key, entry, false)
    }
    this.buckets.clear()
  }

  private bucketKey(lang: string | undefined, segmentId: string | undefined) {
    return `${lang ?? ''}:${segmentId ?? '_'}`
  }

  private flushBucket(key: string, entry: BufferEntry, done: boolean): void {
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = undefined
    }
    const hasText = entry.text.length > 0
    const hasPartial = entry.partialPending
    if (!hasText && !hasPartial && !done) {
      // Nothing to send; drop the bucket entry.
      this.buckets.delete(key)
      return
    }

    const frame: AiTaskUpdateStreamFrame = {}
    if (entry.lang !== undefined) frame.lang = entry.lang
    if (entry.segmentId !== undefined) frame.segmentId = entry.segmentId
    if (hasText) frame.chunk = entry.text
    if (hasPartial) frame.partial = entry.latestPartial
    if (done) frame.done = true

    this.emit(frame)

    if (done) {
      this.buckets.delete(key)
      return
    }
    entry.text = ''
    entry.partialPending = false
    // Keep latestPartial so subsequent flushes only re-send when a new partial
    // arrives; but clear the "pending" flag so we don't re-emit unchanged.
    this.buckets.set(key, entry)
  }
}

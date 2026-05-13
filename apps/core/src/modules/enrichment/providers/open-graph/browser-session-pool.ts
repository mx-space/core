import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'

const execFileAsync = promisify(execFile)

const DEFAULT_EXECUTABLE = process.env.AGENT_BROWSER_BIN || 'agent-browser'
const DEFAULT_MAX_SIZE = Number(process.env.AGENT_BROWSER_MAX_CONCURRENT ?? '2')
const DEFAULT_IDLE_MS = Number(process.env.AGENT_BROWSER_IDLE_MS ?? '60000')
const CLOSE_TIMEOUT_MS = 5_000

export interface PoolSlot {
  readonly name: string
}

export interface AcquireOptions {
  signal?: AbortSignal
}

export interface ReleaseOptions {
  /**
   * Close the underlying session and discard the slot. Use when the command
   * that ran on this slot raised a non-timeout error so the next caller does
   * not reuse a potentially-broken chromium state.
   */
  discard?: boolean
}

interface InternalSlot {
  index: number
  name: string
  inUse: boolean
  /** chromium has actually been started under this name. */
  live: boolean
  idleTimer?: NodeJS.Timeout
}

interface Waiter {
  resolve: (slot: PoolSlot) => void
  reject: (err: Error) => void
  signal?: AbortSignal
  onAbort?: () => void
}

export interface BrowserSessionPoolOptions {
  maxSize?: number
  idleMs?: number
  executable?: string
}

/**
 * Bounded pool of long-lived `agent-browser --session` names. Acts as both a
 * resource cache (avoids per-request chromium spin-up) and a concurrency
 * semaphore (no more than `maxSize` in-flight captures).
 *
 * State note: chromium cookies / localStorage persist across reuses of the
 * same slot. Open Graph fetches do not send credentials, so cross-origin
 * leakage is bounded to whatever a previously-visited page chose to set
 * publicly. Operators wanting stricter isolation should set
 * `AGENT_BROWSER_MAX_CONCURRENT=1` + `AGENT_BROWSER_IDLE_MS=0` which approximates
 * the per-request lifecycle the pool replaced.
 */
@Injectable()
export class BrowserSessionPool implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserSessionPool.name)
  private readonly maxSize: number
  private readonly idleMs: number
  private readonly executable: string

  private readonly slots: InternalSlot[] = []
  private readonly waiters: Waiter[] = []
  private shuttingDown = false

  constructor(options?: BrowserSessionPoolOptions) {
    this.maxSize = Math.max(1, options?.maxSize ?? DEFAULT_MAX_SIZE)
    this.idleMs = Math.max(0, options?.idleMs ?? DEFAULT_IDLE_MS)
    this.executable = options?.executable ?? DEFAULT_EXECUTABLE
  }

  async acquire(options?: AcquireOptions): Promise<PoolSlot> {
    if (this.shuttingDown) {
      throw new Error('BrowserSessionPool has been shut down')
    }
    const free = this.slots.find((s) => !s.inUse)
    if (free) {
      this.cancelIdleTimer(free)
      free.inUse = true
      return { name: free.name }
    }
    if (this.slots.length < this.maxSize) {
      const slot: InternalSlot = {
        index: this.slots.length,
        name: `og-pool-${this.slots.length}`,
        inUse: true,
        live: false,
      }
      this.slots.push(slot)
      return { name: slot.name }
    }
    return new Promise<PoolSlot>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal: options?.signal }
      if (options?.signal) {
        if (options.signal.aborted) {
          reject(new Error('acquire aborted'))
          return
        }
        waiter.onAbort = () => {
          const i = this.waiters.indexOf(waiter)
          if (i !== -1) this.waiters.splice(i, 1)
          reject(new Error('acquire aborted'))
        }
        options.signal.addEventListener('abort', waiter.onAbort, { once: true })
      }
      this.waiters.push(waiter)
    })
  }

  release(slot: PoolSlot, options?: ReleaseOptions): void {
    const internal = this.slots.find((s) => s.name === slot.name)
    if (!internal) return
    internal.inUse = false
    if (options?.discard) {
      // Mark live so close is issued even for a slot that never reported a
      // successful command — caller saw an error and wants chromium torn down.
      internal.live = true
      void this.closeSlot(internal)
    } else {
      internal.live = true
      this.scheduleIdleClose(internal)
    }
    this.flushWaiter()
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown()
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true
    for (const waiter of this.waiters.splice(0)) {
      if (waiter.signal && waiter.onAbort) {
        waiter.signal.removeEventListener('abort', waiter.onAbort)
      }
      waiter.reject(new Error('BrowserSessionPool has been shut down'))
    }
    await Promise.all(this.slots.splice(0).map((s) => this.closeSlot(s, true)))
  }

  /**
   * Hook called by `BrowserFetchService` after the first successful command on
   * a freshly-allocated slot — at that point chromium has truly started, so
   * subsequent shutdown / discard knows to issue `close`.
   */
  markLive(slot: PoolSlot): void {
    const internal = this.slots.find((s) => s.name === slot.name)
    if (internal) internal.live = true
  }

  private flushWaiter(): void {
    if (this.waiters.length === 0) return
    const free = this.slots.find((s) => !s.inUse)
    if (!free) return
    const waiter = this.waiters.shift()!
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort)
    }
    this.cancelIdleTimer(free)
    free.inUse = true
    waiter.resolve({ name: free.name })
  }

  private cancelIdleTimer(slot: InternalSlot): void {
    if (slot.idleTimer) {
      clearTimeout(slot.idleTimer)
      slot.idleTimer = undefined
    }
  }

  private scheduleIdleClose(slot: InternalSlot): void {
    this.cancelIdleTimer(slot)
    if (this.idleMs <= 0) {
      void this.closeSlot(slot)
      return
    }
    slot.idleTimer = setTimeout(() => {
      slot.idleTimer = undefined
      if (!slot.inUse) void this.closeSlot(slot)
    }, this.idleMs)
  }

  private async closeSlot(
    slot: InternalSlot,
    forceRemoveFromList = false,
  ): Promise<void> {
    this.cancelIdleTimer(slot)
    if (slot.live) {
      try {
        await execFileAsync(
          this.executable,
          ['--session', slot.name, 'close'],
          {
            timeout: CLOSE_TIMEOUT_MS,
            windowsHide: true,
            env: process.env,
          },
        )
      } catch (error) {
        this.logger.debug(
          `pool close failed for ${slot.name}: ${(error as Error).message}`,
        )
      }
    }
    slot.live = false
    if (forceRemoveFromList) return
    const idx = this.slots.indexOf(slot)
    if (idx !== -1) this.slots.splice(idx, 1)
  }
}

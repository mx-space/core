import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common'

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
  // In-flight `closeSlot` promises (from idle close / discard release).
  // shutdown awaits these so chromium tear-down is fully drained before the
  // pool is considered destroyed.
  private readonly inFlightCloses = new Set<Promise<void>>()
  private shuttingDown = false

  constructor(@Optional() options?: BrowserSessionPoolOptions) {
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
    internal.live = true
    if (options?.discard) {
      // closeSlot synchronously removes the slot from `this.slots` before
      // awaiting the `close` CLI, so the immediately-following flushWaiter
      // call cannot hand this same slot to a queued acquire mid-teardown.
      this.trackClose(this.closeSlot(internal))
    } else {
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
    // Drain in-flight closes started by release / idle paths so the caller
    // can rely on shutdown() meaning "all chromium is gone".
    if (this.inFlightCloses.size > 0) {
      await Promise.all(this.inFlightCloses)
    }
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
    if (free) {
      const waiter = this.waiters.shift()!
      if (waiter.signal && waiter.onAbort) {
        waiter.signal.removeEventListener('abort', waiter.onAbort)
      }
      this.cancelIdleTimer(free)
      free.inUse = true
      waiter.resolve({ name: free.name })
      return
    }
    // No reusable slot in pool, but headroom exists — typically after a
    // discard or idle-close synchronously evicted a slot. Mint a fresh one
    // so the waiter doesn't sit forever despite available capacity.
    if (this.slots.length < this.maxSize) {
      const slot: InternalSlot = {
        index: this.slots.length,
        name: `og-pool-${this.slots.length}`,
        inUse: true,
        live: false,
      }
      this.slots.push(slot)
      const waiter = this.waiters.shift()!
      if (waiter.signal && waiter.onAbort) {
        waiter.signal.removeEventListener('abort', waiter.onAbort)
      }
      waiter.resolve({ name: slot.name })
    }
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
      this.trackClose(this.closeSlot(slot))
      return
    }
    slot.idleTimer = setTimeout(() => {
      slot.idleTimer = undefined
      if (!slot.inUse) this.trackClose(this.closeSlot(slot))
    }, this.idleMs)
  }

  private trackClose(p: Promise<void>): void {
    this.inFlightCloses.add(p)
    p.finally(() => this.inFlightCloses.delete(p))
  }

  private async closeSlot(
    slot: InternalSlot,
    alreadyRemovedFromList = false,
  ): Promise<void> {
    this.cancelIdleTimer(slot)
    // Remove from the pool SYNCHRONOUSLY before awaiting the CLI close so
    // any concurrent acquire / flushWaiter sees a shorter pool and creates a
    // fresh slot instead of handing this one to a new caller while chromium
    // is being torn down. shutdown() pre-splices and passes the flag.
    if (!alreadyRemovedFromList) {
      const idx = this.slots.indexOf(slot)
      if (idx !== -1) this.slots.splice(idx, 1)
    }
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
  }
}

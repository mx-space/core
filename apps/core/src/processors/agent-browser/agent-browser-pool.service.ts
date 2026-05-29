import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common'

import {
  AGENT_BROWSER_CLOSE_TIMEOUT_MS,
  AGENT_BROWSER_DEFAULT_EXECUTABLE,
  AGENT_BROWSER_DEFAULT_IDLE_MS,
  AGENT_BROWSER_DEFAULT_MAX_SIZE,
} from './agent-browser.constants'

const execFileAsync = promisify(execFile)

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

export interface AgentBrowserSessionPoolOptions {
  maxSize?: number
  idleMs?: number
  executable?: string
}

/**
 * Bounded pool of long-lived `agent-browser --session` names. Acts as both a
 * resource cache (avoids per-request chromium spin-up) and a concurrency
 * semaphore (no more than `maxSize` in-flight commands).
 *
 * Lifecycle invariants:
 *   - chromium is only started lazily on first command on a slot
 *   - idle slots close themselves after `idleMs` so we do not hold dozens of
 *     headless Chromiums in RAM between bursts
 *   - `release(slot, { discard: true })` synchronously evicts a wedged slot
 *     so a subsequent acquire does not reuse a broken chromium state
 *   - `onModuleDestroy` drains every in-flight close, so Nest shutdown means
 *     "no more chromium processes"
 */
@Injectable()
export class AgentBrowserSessionPool implements OnModuleDestroy {
  private readonly logger = new Logger(AgentBrowserSessionPool.name)
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

  constructor(@Optional() options?: AgentBrowserSessionPoolOptions) {
    this.maxSize = Math.max(
      1,
      options?.maxSize ?? AGENT_BROWSER_DEFAULT_MAX_SIZE,
    )
    this.idleMs = Math.max(0, options?.idleMs ?? AGENT_BROWSER_DEFAULT_IDLE_MS)
    this.executable = options?.executable ?? AGENT_BROWSER_DEFAULT_EXECUTABLE
  }

  get executableName(): string {
    return this.executable
  }

  async acquire(options?: AcquireOptions): Promise<PoolSlot> {
    if (this.shuttingDown) {
      throw new Error('AgentBrowserSessionPool has been shut down')
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
        name: this.buildSlotName(this.slots.length),
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
      waiter.reject(new Error('AgentBrowserSessionPool has been shut down'))
    }
    await Promise.all(this.slots.splice(0).map((s) => this.closeSlot(s, true)))
    // Drain in-flight closes started by release / idle paths so the caller
    // can rely on shutdown() meaning "all chromium is gone".
    if (this.inFlightCloses.size > 0) {
      await Promise.all(this.inFlightCloses)
    }
  }

  /**
   * Hook called by callers after the first successful command on a freshly-
   * allocated slot — at that point chromium has truly started, so subsequent
   * shutdown / discard knows to issue `close`.
   */
  markLive(slot: PoolSlot): void {
    const internal = this.slots.find((s) => s.name === slot.name)
    if (internal) internal.live = true
  }

  private buildSlotName(index: number): string {
    return `agent-browser-${index}`
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
        name: this.buildSlotName(this.slots.length),
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
            timeout: AGENT_BROWSER_CLOSE_TIMEOUT_MS,
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

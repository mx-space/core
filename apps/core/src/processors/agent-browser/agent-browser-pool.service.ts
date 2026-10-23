import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
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
  describeAgentBrowserError,
} from './agent-browser.constants'
import {
  type BrowserEgressProxy,
  createBrowserEgressProxy,
} from './browser-egress-proxy'

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
  name: string
  inUse: boolean
  closing?: Promise<void>
  quarantined?: boolean
  /** chromium has actually been started under this name. */
  live: boolean
  idleTimer?: NodeJS.Timeout
}

interface Waiter {
  resolve: (slot: PoolSlot) => void
  reject: (err: Error) => void
  signal?: AbortSignal
  onAbort?: () => void
  timer?: NodeJS.Timeout
}

export interface AgentBrowserSessionPoolOptions {
  maxSize?: number
  idleMs?: number
  executable?: string
}

/** Session ownership includes closing and quarantined browsers, not just callers. */
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
  private readonly sessionPrefix = `agent-browser-${process.pid}-${randomUUID()}`
  private nextSession = 0
  private proxy?: Promise<BrowserEgressProxy>

  async getProxyUrl(): Promise<string> {
    if (this.shuttingDown) throw new Error('Browser pool shut down')
    this.proxy ??= createBrowserEgressProxy()
    return (await this.proxy).url
  }

  constructor(@Optional() options?: AgentBrowserSessionPoolOptions) {
    const maxSize = options?.maxSize ?? AGENT_BROWSER_DEFAULT_MAX_SIZE
    this.maxSize = Number.isFinite(maxSize)
      ? Math.max(1, Math.floor(maxSize))
      : 2
    const idleMs = options?.idleMs ?? AGENT_BROWSER_DEFAULT_IDLE_MS
    this.idleMs = Number.isFinite(idleMs) ? Math.max(0, idleMs) : 60_000
    this.executable = options?.executable ?? AGENT_BROWSER_DEFAULT_EXECUTABLE
  }

  get executableName(): string {
    return this.executable
  }

  get health() {
    return {
      capacity: this.maxSize,
      quarantined: this.slots.filter((slot) => slot.quarantined).length,
    }
  }

  async acquire(options?: AcquireOptions): Promise<PoolSlot> {
    if (this.shuttingDown) {
      throw new Error('AgentBrowserSessionPool has been shut down')
    }
    if (options?.signal?.aborted) throw new Error('acquire aborted')
    if (
      this.slots.length === this.maxSize &&
      this.slots.every((s) => s.quarantined)
    ) {
      throw new Error(
        'Browser pool unavailable: sessions quarantined after close failure',
      )
    }
    const free = this.slots.find(
      (s) => !s.inUse && !s.closing && !s.quarantined,
    )
    if (free) {
      this.cancelIdleTimer(free)
      free.inUse = true
      return { name: free.name }
    }
    if (this.slots.length < this.maxSize) {
      const slot: InternalSlot = {
        name: this.buildSlotName(),
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
          this.cleanWaiter(waiter)
          reject(new Error('acquire aborted'))
        }
        options.signal.addEventListener('abort', waiter.onAbort, { once: true })
      }
      waiter.timer = setTimeout(() => {
        const i = this.waiters.indexOf(waiter)
        if (i !== -1) this.waiters.splice(i, 1)
        this.cleanWaiter(waiter)
        reject(new Error('Browser pool acquire timed out'))
      }, 30_000)
      this.waiters.push(waiter)
    })
  }

  release(slot: PoolSlot, options?: ReleaseOptions): void {
    const internal = this.slots.find((s) => s.name === slot.name)
    if (
      !internal ||
      !internal.inUse ||
      internal.closing ||
      internal.quarantined
    )
      return
    internal.inUse = false
    internal.live = true
    if (options?.discard) {
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
      this.cleanWaiter(waiter)
      waiter.reject(new Error('AgentBrowserSessionPool has been shut down'))
    }
    await Promise.all(this.slots.map((s) => this.closeSlot(s)))
    // Drain in-flight closes started by release / idle paths so the caller
    // can await all close attempts; quarantined sessions remain owned until exit.
    if (this.inFlightCloses.size > 0) {
      await Promise.all(this.inFlightCloses)
    }
    if (this.proxy) await (await this.proxy).close()
  }

  /** Mark before launching: a failed CLI may already have created its daemon. */
  markLive(slot: PoolSlot): void {
    const internal = this.slots.find((s) => s.name === slot.name)
    if (internal) internal.live = true
  }

  private buildSlotName(): string {
    return `${this.sessionPrefix}-${this.nextSession++}`
  }

  private cleanWaiter(waiter: Waiter): void {
    clearTimeout(waiter.timer)
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort)
    }
  }

  private flushWaiter(): void {
    if (this.shuttingDown) return
    while (this.waiters.length) {
      let free = this.slots.find(
        (s) => !s.inUse && !s.closing && !s.quarantined,
      )
      if (!free && this.slots.length < this.maxSize) {
        free = { name: this.buildSlotName(), inUse: false, live: false }
        this.slots.push(free)
      }
      if (!free) {
        if (this.slots.every((s) => s.quarantined)) {
          for (const waiter of this.waiters.splice(0)) {
            this.cleanWaiter(waiter)
            waiter.reject(
              new Error(
                'Browser pool unavailable: sessions quarantined after close failure',
              ),
            )
          }
        }
        return
      }
      const waiter = this.waiters.shift()!
      this.cleanWaiter(waiter)
      this.cancelIdleTimer(free)
      free.inUse = true
      waiter.resolve({ name: free.name })
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

  private closeSlot(slot: InternalSlot): Promise<void> {
    if (slot.closing) return slot.closing
    this.cancelIdleTimer(slot)
    // Keep ownership and capacity until close has actually completed.
    slot.closing = this.performClose(slot)
    return slot.closing
  }

  private async performClose(slot: InternalSlot): Promise<void> {
    // Yield so closeSlot installs the closing marker before completion.
    await Promise.resolve()
    let closed = !slot.live
    for (let attempt = 0; !closed && attempt < 2; attempt++) {
      try {
        await execFileAsync(
          this.executable,
          ['--session', slot.name, 'close'],
          {
            timeout: AGENT_BROWSER_CLOSE_TIMEOUT_MS,
            killSignal: 'SIGKILL',
            maxBuffer: 16_384,
            windowsHide: true,
            env: process.env,
          },
        )
        closed = true
      } catch (error) {
        // Do not log execFile.message: it contains command arguments and stderr.
        this.logger.warn(
          `Browser close failed: session=${slot.name} attempt=${attempt + 1} ${describeAgentBrowserError(error)}`,
        )
      }
    }
    slot.closing = undefined
    if (closed) {
      slot.live = false
      const index = this.slots.indexOf(slot)
      if (index !== -1) this.slots.splice(index, 1)
    } else {
      // Fail closed: never mint replacement browsers for unconfirmed exits.
      slot.quarantined = true
    }
    this.flushWaiter()
  }
}

# Browser Fetch Session Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-request agent-browser session lifecycle with a bounded pool of long-lived sessions that double as a concurrency semaphore, and close the SSRF gap on the browser fetch path.

**Architecture:** A new `BrowserSessionPool` provider owns up to N (default 2) named long-lived `agent-browser` sessions, lazily created. Each acquisition reserves one slot; concurrent requests beyond the cap queue FIFO. Slots are released back (not closed) on success and discarded (`close` sent, slot removed) on non-timeout failure. An idle timer closes long-unused slots so an idle deploy does not pin chromium in memory. `BrowserFetchService.runSession` is refactored to acquire/release instead of creating a random per-request session. SSRF guards (`parseAndValidateUrl` + `assertHostnameSafe` from `safe-fetch`) are extracted and reused on the browser path so a private/loopback hostname can no longer reach chromium.

**Tech Stack:** NestJS (`@Injectable` + `OnModuleDestroy`), Node `child_process.execFile`, Vitest with `vi.useFakeTimers()` for queue/idle tests.

---

## File Structure

- **Create**: `apps/core/src/modules/enrichment/providers/open-graph/browser-session-pool.ts` — pool service, queue, idle eviction, shutdown.
- **Create**: `apps/core/test/src/modules/enrichment/browser-session-pool.spec.ts` — unit tests for acquire/release/queue/discard/idle/shutdown.
- **Create**: `apps/core/src/modules/enrichment/providers/open-graph/url-guard.ts` — extracted SSRF helpers shared between `safe-fetch` and `browser-fetch`.
- **Modify**: `apps/core/src/modules/enrichment/providers/open-graph/safe-fetch.ts` — re-export the SSRF helpers from `url-guard.ts`; remove the inline copies.
- **Modify**: `apps/core/src/modules/enrichment/providers/open-graph/browser-fetch.service.ts` — replace `runSession` random-session lifecycle with pool acquire/release; apply SSRF guard before invoking chromium.
- **Modify**: `apps/core/src/modules/enrichment/enrichment.module.ts` — register `BrowserSessionPool` provider.
- **Modify**: `apps/core/test/src/modules/enrichment/browser-fetch.service.spec.ts` — adapt assertions to pool-based session names (`og-pool-0`) and the absence of a per-request `close` call.

Each file has one clear responsibility. `url-guard.ts` is added because the SSRF logic needs to live outside `safe-fetch` to be reused without creating a circular dependency between `safe-fetch` and `browser-fetch`.

---

## Task 1: Extract SSRF guards into `url-guard.ts`

**Files:**
- Create: `apps/core/src/modules/enrichment/providers/open-graph/url-guard.ts`
- Modify: `apps/core/src/modules/enrichment/providers/open-graph/safe-fetch.ts`
- Test: existing `safe-fetch` tests must keep passing (no new spec)

- [ ] **Step 1: Create the shared guard module**

Create `apps/core/src/modules/enrichment/providers/open-graph/url-guard.ts`:

```ts
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { isDev } from '~/global/env.global'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
])

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal']

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export function parseAndValidateUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Disallowed protocol: ${url.protocol}`)
  }
  const host = url.hostname.toLowerCase()
  if (!host) throw new UnsafeUrlError('Empty hostname')
  if (isDev) return url
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new UnsafeUrlError(`Blocked hostname: ${host}`)
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError(`Blocked hostname suffix: ${host}`)
  }
  const stripped = stripIpv6Brackets(host)
  const ipKind = isIP(stripped)
  if (ipKind !== 0 && isPrivateIp(stripped, ipKind)) {
    throw new UnsafeUrlError(`Private IP literal: ${host}`)
  }
  return url
}

export async function assertHostnameSafe(hostname: string): Promise<void> {
  if (isIP(stripIpv6Brackets(hostname)) !== 0) return
  let addrs: { address: string; family: number }[]
  try {
    addrs = await lookup(hostname, { all: true })
  } catch (error) {
    throw new UnsafeUrlError(
      `DNS lookup failed for ${hostname}: ${(error as Error).message}`,
    )
  }
  if (addrs.length === 0) {
    throw new UnsafeUrlError(`No DNS records for ${hostname}`)
  }
  for (const a of addrs) {
    if (isPrivateIp(a.address, a.family === 4 ? 4 : 6)) {
      throw new UnsafeUrlError(
        `Hostname ${hostname} resolves to private/internal IP ${a.address}`,
      )
    }
  }
}

export function stripIpv6Brackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1)
  return host
}

export function isPrivateIp(addr: string, family: number): boolean {
  if (family === 4) return isPrivateIpv4(addr)
  if (family === 6) return isPrivateIpv6(addr)
  return true
}

function isPrivateIpv4(addr: string): boolean {
  const parts = addr.split('.').map((p) => Number(p))
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(addr: string): boolean {
  const lower = addr.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  const v4mapped = /^:{2}f{4}:((?:\d+\.){3}\d+)$/i.exec(addr)
  if (v4mapped) return isPrivateIpv4(v4mapped[1])
  if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true
  if (lower.startsWith('fea') || lower.startsWith('feb')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('ff')) return true
  return false
}
```

- [ ] **Step 2: Replace inline definitions in `safe-fetch.ts` with imports**

In `apps/core/src/modules/enrichment/providers/open-graph/safe-fetch.ts`:

Remove the inline `BLOCKED_HOSTNAMES`, `BLOCKED_HOSTNAME_SUFFIXES`, `UnsafeUrlError`, `parseAndValidateUrl`, `assertHostnameSafe`, `stripIpv6Brackets`, `isPrivateIp`, `isPrivateIpv4`, `isPrivateIpv6`, and the imports of `lookup`/`isIP`/`isDev` that those used.

Add at the top:

```ts
import {
  assertHostnameSafe,
  parseAndValidateUrl,
  UnsafeUrlError,
  isPrivateIp,
} from './url-guard'
```

Keep the existing `export { UnsafeUrlError, isPrivateIp }` shape so external consumers (if any) of `safe-fetch.ts` keep working. Add a re-export line:

```ts
export { UnsafeUrlError, isPrivateIp } from './url-guard'
```

- [ ] **Step 3: Run lint + typecheck on the changed files**

Run: `pnpm -C apps/core exec eslint src/modules/enrichment/providers/open-graph/safe-fetch.ts src/modules/enrichment/providers/open-graph/url-guard.ts`
Expected: 0 errors.

Run: `pnpm -C apps/core exec tsc --noEmit -p tsconfig.json` (the project's `tsc` config validates the whole tree)
Expected: 0 errors.

- [ ] **Step 4: Run the existing safe-fetch tests**

Run: `pnpm -C apps/core run test -- test/src/modules/enrichment/providers/open-graph/safe-fetch.spec.ts`

If no such file exists, run: `pnpm -C apps/core run test -- test/src/modules/enrichment`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/enrichment/providers/open-graph/url-guard.ts \
        apps/core/src/modules/enrichment/providers/open-graph/safe-fetch.ts
git commit -m "refactor(enrichment): extract SSRF guards into shared url-guard module"
```

---

## Task 2: Implement `BrowserSessionPool` (test-first)

**Files:**
- Create: `apps/core/src/modules/enrichment/providers/open-graph/browser-session-pool.ts`
- Test: `apps/core/test/src/modules/enrichment/browser-session-pool.spec.ts`

### Step 2.1: Write the pool spec (all failing)

- [ ] **Step 1: Write the failing tests**

Create `apps/core/test/src/modules/enrichment/browser-session-pool.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}))

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>(
    'node:child_process',
  )
  return { ...actual, execFile: execFileMock }
})

const { BrowserSessionPool } = await import(
  '~/modules/enrichment/providers/open-graph/browser-session-pool'
)

function mockExecFileSuccess(): void {
  execFileMock.mockImplementation((...args: unknown[]) => {
    const cb = args.at(-1) as (
      err: NodeJS.ErrnoException | null,
      r?: { stdout: string; stderr: string },
    ) => void
    setImmediate(() => cb(null, { stdout: '[]', stderr: '' }))
    return undefined
  })
}

beforeEach(() => {
  execFileMock.mockReset()
  mockExecFileSuccess()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BrowserSessionPool', () => {
  it('acquire returns a slot named og-pool-0 on first use', async () => {
    const pool = new BrowserSessionPool({ maxSize: 2, idleMs: 60_000 })
    const slot = await pool.acquire()
    expect(slot.name).toBe('og-pool-0')
    pool.release(slot)
    await pool.shutdown()
  })

  it('two concurrent acquires up to cap return distinct slots without queueing', async () => {
    const pool = new BrowserSessionPool({ maxSize: 2, idleMs: 60_000 })
    const a = await pool.acquire()
    const b = await pool.acquire()
    expect([a.name, b.name].sort()).toEqual(['og-pool-0', 'og-pool-1'])
    pool.release(a)
    pool.release(b)
    await pool.shutdown()
  })

  it('third acquire at cap blocks until a slot is released', async () => {
    const pool = new BrowserSessionPool({ maxSize: 2, idleMs: 60_000 })
    const a = await pool.acquire()
    const b = await pool.acquire()
    const cPromise = pool.acquire()
    let resolved = false
    cPromise.then(() => {
      resolved = true
    })
    await Promise.resolve()
    expect(resolved).toBe(false)
    pool.release(a)
    const c = await cPromise
    expect(c.name).toBe(a.name)
    pool.release(b)
    pool.release(c)
    await pool.shutdown()
  })

  it('release with discard:true closes the session and frees the slot', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
    const a = await pool.acquire()
    pool.release(a, { discard: true })
    // discard issues a close; next acquire creates a fresh session with the
    // same name (slot index reused).
    const b = await pool.acquire()
    expect(b.name).toBe(a.name)
    const closedCall = execFileMock.mock.calls.find(
      (call) => (call[1] as string[]).at(-1) === 'close',
    )
    expect(closedCall).toBeDefined()
    pool.release(b)
    await pool.shutdown()
  })

  it('idle slot is closed after idleMs and the slot index is recyclable', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 1_000 })
    const a = await pool.acquire()
    pool.release(a)
    expect(execFileMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    await vi.runAllTicks()
    const closedCall = execFileMock.mock.calls.find(
      (call) => (call[1] as string[]).at(-1) === 'close',
    )
    expect(closedCall).toBeDefined()
    await pool.shutdown()
  })

  it('shutdown closes every live slot', async () => {
    const pool = new BrowserSessionPool({ maxSize: 2, idleMs: 60_000 })
    const a = await pool.acquire()
    const b = await pool.acquire()
    pool.release(a)
    pool.release(b)
    await pool.shutdown()
    const closeCalls = execFileMock.mock.calls.filter(
      (call) => (call[1] as string[]).at(-1) === 'close',
    )
    expect(closeCalls.length).toBe(2)
  })

  it('acquire after shutdown rejects', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
    await pool.shutdown()
    await expect(pool.acquire()).rejects.toThrow(/shut down/i)
  })

  it('acquire waiter cancelled by aborted signal rejects without consuming a slot', async () => {
    const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
    const a = await pool.acquire()
    const ac = new AbortController()
    const waiter = pool.acquire({ signal: ac.signal })
    ac.abort()
    await expect(waiter).rejects.toThrow(/aborted/i)
    pool.release(a)
    // ensure no leftover waiter consumed the freed slot
    const b = await pool.acquire()
    expect(b.name).toBe(a.name)
    pool.release(b)
    await pool.shutdown()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C apps/core run test -- test/src/modules/enrichment/browser-session-pool.spec.ts`
Expected: FAIL with "Cannot find module '.../browser-session-pool'" (file does not exist yet).

### Step 2.2: Implement the pool

- [ ] **Step 3: Create the pool**

Create `apps/core/src/modules/enrichment/providers/open-graph/browser-session-pool.ts`:

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'

const execFileAsync = promisify(execFile)

const DEFAULT_EXECUTABLE = process.env.AGENT_BROWSER_BIN || 'agent-browser'
const DEFAULT_MAX_SIZE = Number(
  process.env.AGENT_BROWSER_MAX_CONCURRENT ?? '2',
)
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
      void this.closeSlot(internal)
    } else {
      // Mark live so subsequent acquirers know agent-browser already
      // has state for this name.
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
    await Promise.all(this.slots.map((s) => this.closeSlot(s, true)))
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
        await execFileAsync(this.executable, ['--session', slot.name, 'close'], {
          timeout: CLOSE_TIMEOUT_MS,
          windowsHide: true,
          env: process.env,
        })
      } catch (error) {
        this.logger.debug(
          `pool close failed for ${slot.name}: ${(error as Error).message}`,
        )
      }
    }
    slot.live = false
    if (forceRemoveFromList) return
    // Discard: remove from list so the index can be reused next time.
    const idx = this.slots.indexOf(slot)
    if (idx !== -1) this.slots.splice(idx, 1)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/core run test -- test/src/modules/enrichment/browser-session-pool.spec.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm -C apps/core exec eslint src/modules/enrichment/providers/open-graph/browser-session-pool.ts test/src/modules/enrichment/browser-session-pool.spec.ts`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/modules/enrichment/providers/open-graph/browser-session-pool.ts \
        apps/core/test/src/modules/enrichment/browser-session-pool.spec.ts
git commit -m "feat(enrichment): bounded browser session pool for OG fetch"
```

---

## Task 3: Refactor `BrowserFetchService` to use the pool + SSRF guard

**Files:**
- Modify: `apps/core/src/modules/enrichment/providers/open-graph/browser-fetch.service.ts`
- Modify: `apps/core/test/src/modules/enrichment/browser-fetch.service.spec.ts`

### Step 3.1: Update browser-fetch tests for pool-based naming

- [ ] **Step 1: Adjust tests**

In `apps/core/test/src/modules/enrichment/browser-fetch.service.spec.ts`:

1. Where the test constructs the service, pass a `BrowserSessionPool` instance:

```ts
import { BrowserSessionPool } from '~/modules/enrichment/providers/open-graph/browser-session-pool'

// inside the relevant test setup:
const pool = new BrowserSessionPool({ maxSize: 2, idleMs: 60_000 })
const service = new BrowserFetchService(pool)
```

2. Replace any assertion that expects a random `og-${hex}` session name with `expect(sessionName).toMatch(/^og-pool-\d+$/)`.

3. Remove or update assertions that expect the service to call `close` after every fetch — the pool now owns close. Tests that need the slot returned can call `await pool.shutdown()` in an afterEach.

4. Add a new test asserting an SSRF rejection:

```ts
it('rejects http://localhost before invoking chromium', async () => {
  const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
  const service = new BrowserFetchService(pool)
  await expect(
    service.fetchPage('http://localhost/path', {
      timeoutMs: 5_000,
      maxBodyBytes: 1024,
    }),
  ).rejects.toThrow(/Blocked hostname|Private IP/)
  expect(execFileMock).not.toHaveBeenCalled()
  await pool.shutdown()
})
```

5. Add a test that verifies pool reuse:

```ts
it('reuses the same session name across two sequential fetches', async () => {
  const pool = new BrowserSessionPool({ maxSize: 1, idleMs: 60_000 })
  const service = new BrowserFetchService(pool)
  setExecFileBehavior(() => ({
    stdout: JSON.stringify([{}, {}, { value: '<html></html>' }]),
  }))
  await service.fetchHtml('https://example.com/a', {
    timeoutMs: 5_000,
    maxBodyBytes: 1024,
  })
  await service.fetchHtml('https://example.com/b', {
    timeoutMs: 5_000,
    maxBodyBytes: 1024,
  })
  const openCalls = execFileMock.mock.calls.filter((call) => {
    const args = call[1] as string[]
    return args.includes('batch') && args.some((a) => a.startsWith('open '))
  })
  expect(openCalls.length).toBe(2)
  const sessionNames = new Set(
    openCalls.map((call) => (call[1] as string[])[1]),
  )
  expect(sessionNames.size).toBe(1)
  await pool.shutdown()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C apps/core run test -- test/src/modules/enrichment/browser-fetch.service.spec.ts`
Expected: the new SSRF and reuse tests FAIL; existing tests may also fail due to constructor signature change.

### Step 3.2: Refactor the service

- [ ] **Step 3: Refactor `browser-fetch.service.ts`**

In `apps/core/src/modules/enrichment/providers/open-graph/browser-fetch.service.ts`:

1. Remove the random `og-${randomBytes(6)…}` naming and the final `close` invocation in `runSession`.
2. Inject `BrowserSessionPool` and import the SSRF guard:

```ts
import { Injectable, Logger } from '@nestjs/common'
import {
  assertHostnameSafe,
  parseAndValidateUrl,
} from './url-guard'
import {
  BrowserSessionPool,
  type PoolSlot,
} from './browser-session-pool'
```

3. New constructor:

```ts
constructor(private readonly pool: BrowserSessionPool) {}
```

4. Replace `runSession` so it:
   - calls `parseAndValidateUrl(rawUrl)` then `await assertHostnameSafe(url.hostname)` (skipping the dev escape hatch is handled inside the helper),
   - acquires a slot from the pool,
   - runs the HTML batch (same args, but using `slot.name` for `--session`),
   - on first success calls `pool.markLive(slot)`,
   - runs the screenshot batch when `captureScreenshot` is true,
   - releases the slot on success (no `close`),
   - on a thrown error: if it is a `UnsafeUrlError` (caught before acquiring), no release; if it happens after acquire, release with `{ discard: true }` for non-timeout errors and `{ discard: false }` for timeout errors (a timed-out session may still be healthy; let idle eviction handle it if not).

Replace the body of `runSession` with:

```ts
private async runSession(
  rawUrl: string,
  opts: SafeFetchOptions & { executable?: string },
  captureScreenshot: boolean,
): Promise<FetchPageResult> {
  const url = parseAndValidateUrl(rawUrl)
  await assertHostnameSafe(url.hostname)

  const slot = await this.pool.acquire()
  const executable = opts.executable || DEFAULT_EXECUTABLE
  const evalScript =
    '(() => { try { return document.documentElement.outerHTML } catch (_e) { return "" } })()'
  const b64 = Buffer.from(evalScript, 'utf8').toString('base64')

  const started = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs)
  let html: SafeFetchResult
  let acquired = true
  let timedOut = false
  try {
    const { stdout } = await execFileAsync(
      executable,
      [
        '--session',
        slot.name,
        'batch',
        '--bail',
        '--json',
        `open ${url.toString()}`,
        'wait 1500',
        `eval -b ${b64} --json`,
      ],
      {
        signal: ac.signal,
        maxBuffer: Math.max(opts.maxBodyBytes * 2, 4_194_304),
        windowsHide: true,
        env: process.env,
      },
    )
    this.pool.markLive(slot)
    const rawHtml = extractHtmlFromBatchOutput(stdout)
    const truncated = rawHtml.length > opts.maxBodyBytes
    const body = truncated ? rawHtml.slice(0, opts.maxBodyBytes) : rawHtml
    html = {
      finalUrl: url.toString(),
      contentType: 'text/html',
      body,
      truncated,
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string }
    if (ac.signal.aborted) {
      timedOut = true
      this.pool.release(slot)
      acquired = false
      throw new Error(
        `agent-browser timed out after ${opts.timeoutMs}ms for ${url.toString()}`,
        { cause: error },
      )
    }
    this.pool.release(slot, { discard: true })
    acquired = false
    if (err.code === 'ENOENT') {
      throw new Error(
        `agent-browser executable not found at "${executable}". Install it or set thirdPartyServiceIntegration.openGraph.fetchMode = "fetch".`,
        { cause: error },
      )
    }
    const detail = err.stderr ? `: ${truncate(err.stderr, 400)}` : ''
    throw new Error(`agent-browser failed for ${url.toString()}${detail}`, {
      cause: error,
    })
  } finally {
    clearTimeout(timer)
  }

  let screenshotBytes: Buffer | undefined
  if (captureScreenshot && acquired && !timedOut) {
    const remaining = Math.max(500, opts.timeoutMs - (Date.now() - started))
    screenshotBytes = await this.captureScreenshot(
      executable,
      slot.name,
      remaining,
    ).catch((screenshotErr) => {
      this.logger.debug(
        `screenshot capture failed for ${url.toString()}: ${(screenshotErr as Error).message}`,
      )
      return undefined
    })
  }

  if (acquired) this.pool.release(slot)
  return { html, screenshotBytes }
}
```

5. Delete the import of `randomBytes` (no longer used) at the top of the file.

- [ ] **Step 4: Run the browser-fetch tests**

Run: `pnpm -C apps/core run test -- test/src/modules/enrichment/browser-fetch.service.spec.ts`
Expected: all pass, including the two new tests added in Step 1.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm -C apps/core exec eslint src/modules/enrichment/providers/open-graph/browser-fetch.service.ts test/src/modules/enrichment/browser-fetch.service.spec.ts`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/modules/enrichment/providers/open-graph/browser-fetch.service.ts \
        apps/core/test/src/modules/enrichment/browser-fetch.service.spec.ts
git commit -m "refactor(enrichment): browser fetch reuses pool sessions + SSRF guard"
```

---

## Task 4: Wire `BrowserSessionPool` into the enrichment module

**Files:**
- Modify: `apps/core/src/modules/enrichment/enrichment.module.ts`

- [ ] **Step 1: Register the provider**

In `apps/core/src/modules/enrichment/enrichment.module.ts`:

1. Add the import:

```ts
import { BrowserSessionPool } from './providers/open-graph/browser-session-pool'
```

2. Append `BrowserSessionPool` to the `providers` array, before `BrowserFetchService` (Nest resolves DI order from the array order):

```ts
providers: [
  EnrichmentScreenshotRepository,
  EnrichmentService,
  ProviderRegistry,
  UrlExtractorService,
  EnrichmentOriginGuard,
  BrowserSessionPool,
  BrowserFetchService,
  ScreenshotPipelineService,
  ScreenshotStorageService,
  ...allProviders,
],
```

- [ ] **Step 2: Run the full enrichment test suite**

Run: `pnpm -C apps/core run test -- test/src/modules/enrichment`
Expected: all pass.

- [ ] **Step 3: Lint + typecheck the touched module**

Run: `pnpm -C apps/core exec eslint src/modules/enrichment/enrichment.module.ts`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/core/src/modules/enrichment/enrichment.module.ts
git commit -m "feat(enrichment): wire BrowserSessionPool into module"
```

---

## Task 5: Final verification

**Files:** none modified

- [ ] **Step 1: Run the full repository test suite**

Run: `pnpm -C apps/core run test`
Expected: all green (note: pre-existing unrelated suites must continue to pass).

- [ ] **Step 2: Run lint on every touched file**

Run:

```bash
pnpm -C apps/core exec eslint \
  src/modules/enrichment/providers/open-graph/url-guard.ts \
  src/modules/enrichment/providers/open-graph/safe-fetch.ts \
  src/modules/enrichment/providers/open-graph/browser-session-pool.ts \
  src/modules/enrichment/providers/open-graph/browser-fetch.service.ts \
  src/modules/enrichment/enrichment.module.ts \
  test/src/modules/enrichment/browser-session-pool.spec.ts \
  test/src/modules/enrichment/browser-fetch.service.spec.ts
```

Expected: 0 errors.

- [ ] **Step 3: Push and open PR update**

```bash
git push origin feat/enhance-enrichment --force-with-lease
```

Expected: PR #2708 updated with the new commits.

- [ ] **Step 4: Confirm CI is green on the branch**

Visit the PR page and verify Test (shards 1/2/3) and Lint & Typecheck pass.

---

## Self-Review

- **Spec coverage:**
  - Session reuse → Task 2 (pool) + Task 3 (fetch service uses it). ✓
  - Concurrency cap → Task 2 (queue inside pool). ✓
  - SSRF gap from prior review → Task 1 (extract guards) + Task 3 (apply in fetch service). ✓
  - Rebase to master → already done before the plan started. ✓
- **Placeholder scan:** none — every code step contains complete code or an exact command.
- **Type consistency:** `PoolSlot.name`, `BrowserSessionPool.acquire/release/markLive/shutdown/onModuleDestroy`, `AcquireOptions.signal`, `ReleaseOptions.discard` are defined in Task 2 and referenced consistently in Task 3.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-browser-fetch-session-pool.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}))

vi.mock('node:child_process', async () => {
  const actual =
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process',
    )
  return { ...actual, execFile: execFileMock }
})

const { BrowserSessionPool } =
  await import('~/modules/enrichment/providers/open-graph/browser-session-pool')

function mockExecFileSuccess(): void {
  execFileMock.mockImplementation((...args: unknown[]) => {
    const cb = args.at(-1) as (
      err: NodeJS.ErrnoException | null,
      r?: { stdout: string; stderr: string },
    ) => void
    // sync callback so awaits resolve under fake timers without needing
    // setImmediate / microtask flushing
    cb(null, { stdout: '[]', stderr: '' })
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

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FetchImpl } from '../../src/core/self-update'
import {
  buildContextFromFlags,
  maybeNotify,
  readCache,
  shouldSkipNotify,
  writeCacheAtomic,
  type NotifyContext,
} from '../../src/core/update-notifier'

function makeFetchOK(version: string, etag = 'W/"new"'): FetchImpl {
  return async () => ({
    ok: true,
    status: 200,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'etag') return etag
        return null
      },
    },
    async json() {
      return { version, engines: { node: '>=22' }, dist: { tarball: 'x' } }
    },
    async text() {
      return ''
    },
  })
}

function makeFetch304(): FetchImpl {
  return async () => ({
    ok: false,
    status: 304,
    headers: {
      get() {
        return null
      },
    },
    async json() {
      return {}
    },
    async text() {
      return ''
    },
  })
}

function makeFetchBroken(): FetchImpl {
  return async () => {
    throw new Error('network down')
  }
}

let tmpDir: string

function ctx(overrides: Partial<NotifyContext> = {}): NotifyContext {
  return {
    currentVersion: '0.2.0',
    isTTY: true,
    env: {},
    configDir: tmpDir,
    ...overrides,
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mxs-notify-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('shouldSkipNotify', () => {
  it('skips when quiet', () => {
    expect(shouldSkipNotify(ctx({ quiet: true }))).toBe(true)
  })

  it('skips when json flag', () => {
    expect(shouldSkipNotify(ctx({ json: true }))).toBe(true)
  })

  it('skips when output=json', () => {
    expect(shouldSkipNotify(ctx({ output: 'json' }))).toBe(true)
  })

  it('skips when CI is truthy', () => {
    expect(shouldSkipNotify(ctx({ env: { CI: 'true' } }))).toBe(true)
    expect(shouldSkipNotify(ctx({ env: { CI: '1' } }))).toBe(true)
  })

  it('does not skip when CI is empty/0/false', () => {
    expect(shouldSkipNotify(ctx({ env: { CI: '' } }))).toBe(false)
    expect(shouldSkipNotify(ctx({ env: { CI: '0' } }))).toBe(false)
    expect(shouldSkipNotify(ctx({ env: { CI: 'false' } }))).toBe(false)
  })

  it('skips when MXS_NO_UPDATE_CHECK=1', () => {
    expect(shouldSkipNotify(ctx({ env: { MXS_NO_UPDATE_CHECK: '1' } }))).toBe(true)
  })

  it('skips when stderr is not a TTY', () => {
    expect(shouldSkipNotify(ctx({ isTTY: false }))).toBe(true)
  })

  it('skips the update command itself', () => {
    expect(shouldSkipNotify(ctx({ commandName: 'update' }))).toBe(true)
  })
})

describe('cache read/write', () => {
  it('writes atomically and reads back', () => {
    const c = ctx()
    writeCacheAtomic(
      { last_check_ts: 123, latest_version: '0.3.0', etag: 'W/"x"' },
      c,
    )
    const read = readCache(c)
    expect(read).toEqual({ last_check_ts: 123, latest_version: '0.3.0', etag: 'W/"x"' })
  })

  it('returns null on missing file', () => {
    const c = ctx()
    expect(readCache(c)).toBeNull()
  })

  it('returns null on corrupt JSON', () => {
    const c = ctx()
    const file = path.join(tmpDir, 'update-check.json')
    require('node:fs').writeFileSync(file, '{not json')
    expect(readCache(c)).toBeNull()
  })
})

describe('maybeNotify', () => {
  it('emits when cache has a newer version (within throttle)', async () => {
    const now = 1_000_000_000_000
    writeCacheAtomic(
      { last_check_ts: now - 1000, latest_version: '0.3.0' },
      ctx(),
    )
    const lines: string[] = []
    await maybeNotify(
      ctx({
        now: () => now,
        emit: (m) => lines.push(m),
      }),
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/0\.2\.0 → 0\.3\.0/)
  })

  it('does not emit when cache version <= current', async () => {
    const now = 1_000_000_000_000
    writeCacheAtomic(
      { last_check_ts: now - 1000, latest_version: '0.2.0' },
      ctx(),
    )
    const lines: string[] = []
    await maybeNotify(
      ctx({
        now: () => now,
        emit: (m) => lines.push(m),
      }),
    )
    expect(lines).toHaveLength(0)
  })

  it('does not fetch within 24h throttle window', async () => {
    const now = 1_000_000_000_000
    writeCacheAtomic(
      { last_check_ts: now - 60_000, latest_version: '0.2.0' },
      ctx(),
    )
    const fetchImpl = vi.fn(makeFetchOK('0.4.0'))
    await maybeNotify(
      ctx({
        now: () => now,
        fetchImpl: fetchImpl as unknown as FetchImpl,
      }),
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fetches when cache is stale and writes new latest, but does not emit on the same run', async () => {
    const now = 1_000_000_000_000
    const stale = now - 25 * 60 * 60 * 1000
    writeCacheAtomic(
      { last_check_ts: stale, latest_version: '0.2.0' },
      ctx(),
    )
    const fetchImpl = makeFetchOK('0.3.0', 'W/"abc"')
    const lines: string[] = []
    await maybeNotify(
      ctx({
        now: () => now,
        fetchImpl,
        emit: (m) => lines.push(m),
      }),
    )
    expect(lines).toHaveLength(0)
    const cache = readCache(ctx())
    expect(cache).toEqual({ last_check_ts: now, latest_version: '0.3.0', etag: 'W/"abc"' })
  })

  it('handles 304 by preserving cached latest_version', async () => {
    const now = 1_000_000_000_000
    const stale = now - 25 * 60 * 60 * 1000
    writeCacheAtomic(
      { last_check_ts: stale, latest_version: '0.3.0', etag: 'W/"old"' },
      ctx(),
    )
    const fetchImpl = makeFetch304()
    await maybeNotify(
      ctx({
        now: () => now,
        fetchImpl,
      }),
    )
    const cache = readCache(ctx())
    expect(cache?.latest_version).toBe('0.3.0')
    expect(cache?.etag).toBe('W/"old"')
    expect(cache?.last_check_ts).toBe(now)
  })

  it('still updates last_check_ts on network failure', async () => {
    const now = 1_000_000_000_000
    const fetchImpl = makeFetchBroken()
    await maybeNotify(
      ctx({
        now: () => now,
        fetchImpl,
      }),
    )
    const cache = readCache(ctx())
    expect(cache?.last_check_ts).toBe(now)
  })

  it('never throws', async () => {
    await expect(
      maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        // intentionally point at a non-existent dir to trigger fs errors
        configDir: '/dev/null/missing',
        now: () => 1,
        fetchImpl: makeFetchOK('0.3.0'),
      }),
    ).resolves.toBeUndefined()
  })
})

describe('buildContextFromFlags', () => {
  it('threads flags through', () => {
    const c = buildContextFromFlags({
      currentVersion: '0.2.0',
      flags: { quiet: true, json: false, output: 'pretty-json' },
      commandName: 'post',
      parentName: '',
    })
    expect(c.currentVersion).toBe('0.2.0')
    expect(c.quiet).toBe(true)
    expect(c.commandName).toBe('post')
  })
})

// keep linter quiet about unused import in some paths
void existsSync

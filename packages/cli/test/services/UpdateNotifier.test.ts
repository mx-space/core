import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Effect } from 'effect'

import {
  buildUpgradeCommand,
  compareSemver,
  detectPackageManager,
  type FetchImpl,
  fetchLatestVersion,
  make,
  readCache,
  satisfiesNodeEngine,
  shouldSkipNotify,
  type SpawnUpgradeResult,
  UpdateNotifier,
  writeCacheAtomic,
  layer as updateNotifierLayer,
} from '../../src/services/UpdateNotifier'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function makeFetchOKWithEngine(
  version: string,
  engine: string,
  etag = 'W/"new"',
): FetchImpl {
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
      return { version, engines: { node: engine }, dist: { tarball: 'x' } }
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

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mxs-notify-next-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Pure helpers (mirror legacy self-update.test.ts assertions)
// ---------------------------------------------------------------------------

describe('detectPackageManager', () => {
  it('detects npm Linux global install', () => {
    const res = detectPackageManager(
      '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('global')
    if (res.kind === 'global') expect(res.pm).toBe('npm')
  })

  it('detects pnpm macOS global', () => {
    const res = detectPackageManager(
      '/Users/x/Library/pnpm/global/5/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('global')
    if (res.kind === 'global') expect(res.pm).toBe('pnpm')
  })

  it('detects bun global install', () => {
    const res = detectPackageManager(
      '/Users/x/.bun/install/global/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('global')
    if (res.kind === 'global') expect(res.pm).toBe('bun')
  })

  it('detects yarn global install', () => {
    const res = detectPackageManager(
      '/Users/x/.config/yarn/global/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('global')
    if (res.kind === 'global') expect(res.pm).toBe('yarn')
  })

  it('detects monorepo dev source', () => {
    const res = detectPackageManager('/repo/packages/cli/src/bin/mxs.ts')
    expect(res.kind).toBe('dev')
    if (res.kind === 'dev') expect(res.reason).toBe('monorepo-source')
  })

  it('detects monorepo dist and other transient caches', () => {
    const dist = detectPackageManager('/repo/packages/cli/dist/bin/mxs.mjs')
    expect(dist.kind).toBe('dev')
    if (dist.kind === 'dev') expect(dist.reason).toBe('monorepo-dist')

    const pnpmDlx = detectPackageManager(
      '/Users/x/.pnpm-store/dlx/abc/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(pnpmDlx.kind).toBe('transient')
    if (pnpmDlx.kind === 'transient') expect(pnpmDlx.cache).toBe('pnpm-dlx')

    const bunx = detectPackageManager(
      '/Users/x/.bun/install/cache/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(bunx.kind).toBe('transient')
    if (bunx.kind === 'transient') expect(bunx.cache).toBe('bunx')
  })

  it('detects npx transient cache', () => {
    const res = detectPackageManager(
      '/Users/x/.npm/_npx/abc/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('transient')
    if (res.kind === 'transient') expect(res.cache).toBe('npx')
  })

  it('returns unknown when nothing matches', () => {
    expect(detectPackageManager('/some/exotic/path/mxs').kind).toBe('unknown')
  })
})

describe('compareSemver', () => {
  it('orders patch versions', () => {
    expect(compareSemver('0.2.0', '0.2.1')).toBe(-1)
    expect(compareSemver('0.2.1', '0.2.0')).toBe(1)
    expect(compareSemver('0.2.0', '0.2.0')).toBe(0)
  })

  it('orders prerelease less than release', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBe(-1)
  })

  it('orders prerelease identifiers and falls back for invalid versions', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1)
    expect(compareSemver('1.0.0-rc.2', '1.0.0-rc.1')).toBe(1)
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1)
    expect(compareSemver('1.0.0-beta.2', '1.0.0-beta.alpha')).toBe(-1)
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBe(1)
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc')).toBe(1)
    expect(compareSemver('1.0.0-rc.alpha', '1.0.0-rc.1')).toBe(1)
    expect(compareSemver('bad', 'bad')).toBe(0)
    expect(compareSemver('bad-a', 'bad-b')).toBe(-1)
  })
})

describe('buildUpgradeCommand', () => {
  it('builds npm latest', () => {
    expect(buildUpgradeCommand('npm', 'stable')).toEqual({
      cmd: 'npm',
      args: ['install', '-g', '@mx-space/cli@latest'],
    })
  })

  it('uses @next for prerelease channel', () => {
    expect(buildUpgradeCommand('npm', 'next').args).toContain(
      '@mx-space/cli@next',
    )
  })

  it('builds pnpm, yarn, and bun commands', () => {
    expect(buildUpgradeCommand('pnpm', 'stable')).toEqual({
      cmd: 'pnpm',
      args: ['add', '-g', '@mx-space/cli@latest'],
    })
    expect(buildUpgradeCommand('yarn', 'stable')).toEqual({
      cmd: 'yarn',
      args: ['global', 'add', '@mx-space/cli@latest'],
    })
    expect(buildUpgradeCommand('bun', 'stable')).toEqual({
      cmd: 'bun',
      args: ['add', '-g', '@mx-space/cli@latest'],
    })
  })
})

describe('satisfiesNodeEngine', () => {
  it('accepts >=N when current is greater', () => {
    expect(satisfiesNodeEngine('22.5.0', '>=22')).toBe(true)
  })

  it('rejects when below range', () => {
    expect(satisfiesNodeEngine('20.5.0', '>=22')).toBe(false)
  })

  it('returns true when range is undefined', () => {
    expect(satisfiesNodeEngine('22.5.0', undefined)).toBe(true)
  })

  it('accepts blank and invalid ranges as non-blocking', () => {
    expect(satisfiesNodeEngine('22.5.0', '')).toBe(true)
    expect(satisfiesNodeEngine('22.5.0', 'not a range')).toBe(true)
  })
})

describe('fetchLatestVersion', () => {
  it('returns the latest version', async () => {
    const hit = await fetchLatestVersion('stable', {
      fetchImpl: makeFetchOK('0.3.0', 'W/"abc"'),
    })
    expect('notModified' in hit).toBe(false)
    if (!('notModified' in hit) || !hit.notModified) {
      expect(hit.version).toBe('0.3.0')
      expect(hit.etag).toBe('W/"abc"')
    }
  })

  it('honors 304 not-modified', async () => {
    const hit = await fetchLatestVersion('stable', {
      fetchImpl: makeFetch304(),
      etag: 'W/"abc"',
    })
    expect('notModified' in hit && hit.notModified).toBe(true)
  })

  it('throws on non-2xx', async () => {
    const fetchImpl: FetchImpl = async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
      async json() {
        return {}
      },
      async text() {
        return ''
      },
    })
    await expect(fetchLatestVersion('stable', { fetchImpl })).rejects.toThrow(
      /status 500/,
    )
  })

  it('uses global fetch and the default registry when no fetch override is supplied', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        async json() {
          return { version: '0.5.0' }
        },
      async text() {
        return ''
      },
    } as unknown as Response)
    try {
      const hit = await fetchLatestVersion('stable')
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@mx-space%2Fcli/latest',
        expect.objectContaining({
          headers: { accept: 'application/json' },
        }),
      )
      expect('notModified' in hit).toBe(false)
      if (!('notModified' in hit)) expect(hit.version).toBe('0.5.0')
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// shouldSkipNotify
// ---------------------------------------------------------------------------

describe('shouldSkipNotify', () => {
  const base = { currentVersion: '0.2.0', isTTY: true, env: {} as NodeJS.ProcessEnv }
  it('skips when quiet', () => {
    expect(shouldSkipNotify({ ...base, quiet: true })).toBe(true)
  })
  it('skips when json flag', () => {
    expect(shouldSkipNotify({ ...base, json: true })).toBe(true)
  })
  it('skips when json output mode is selected', () => {
    expect(shouldSkipNotify({ ...base, output: 'json' })).toBe(true)
  })
  it('skips when CI is truthy', () => {
    expect(shouldSkipNotify({ ...base, env: { CI: 'true' } })).toBe(true)
  })
  it('does not skip when CI=false', () => {
    expect(shouldSkipNotify({ ...base, env: { CI: 'false' } })).toBe(false)
  })
  it('skips when MXS_NO_UPDATE_CHECK=1', () => {
    expect(
      shouldSkipNotify({ ...base, env: { MXS_NO_UPDATE_CHECK: '1' } }),
    ).toBe(true)
  })
  it('skips when not a TTY', () => {
    expect(shouldSkipNotify({ ...base, isTTY: false })).toBe(true)
  })
  it('skips the update command itself', () => {
    expect(shouldSkipNotify({ ...base, commandName: 'update' })).toBe(true)
  })
  it('skips when invoked below the update parent command', () => {
    expect(shouldSkipNotify({ ...base, parentName: 'update' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cache read/write
// ---------------------------------------------------------------------------

describe('cache read/write', () => {
  it('writes atomically and reads back', () => {
    writeCacheAtomic(
      { last_check_ts: 123, latest_version: '0.3.0', etag: 'W/"x"' },
      tmpDir,
    )
    expect(readCache(tmpDir)).toEqual({
      last_check_ts: 123,
      latest_version: '0.3.0',
      etag: 'W/"x"',
    })
  })

  it('returns null on missing file', () => {
    expect(readCache(tmpDir)).toBeNull()
  })

  it('returns null on malformed cache content', () => {
    writeCacheAtomic({ last_check_ts: 123 }, tmpDir)
    const cacheFile = path.join(tmpDir, 'update-check.json')
    rmSync(cacheFile, { force: true })
    expect(readCache(tmpDir)).toBeNull()
  })

  it('returns null when cache content has no numeric timestamp', () => {
    const cacheFile = path.join(tmpDir, 'update-check.json')
    writeCacheAtomic({ last_check_ts: 123 }, tmpDir)
    writeFileSync(cacheFile, JSON.stringify({ latest_version: '0.3.0' }))
    expect(readCache(tmpDir)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// maybeNotify — Effect-flavoured behaviour
// ---------------------------------------------------------------------------

describe('maybeNotify', () => {
  it('emits when cache has a newer version (within throttle)', async () => {
    const t = 1_000_000_000_000
    writeCacheAtomic({ last_check_ts: t - 1000, latest_version: '0.3.0' }, tmpDir)
    const lines: string[] = []
    const svc = make({ now: () => t })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        configDir: tmpDir,
        emit: (m) => lines.push(m),
      }),
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/0\.2\.0 → 0\.3\.0/)
  })

  it('does not emit when cache version <= current', async () => {
    const t = 1_000_000_000_000
    writeCacheAtomic({ last_check_ts: t - 1000, latest_version: '0.2.0' }, tmpDir)
    const lines: string[] = []
    const svc = make({ now: () => t })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        configDir: tmpDir,
        emit: (m) => lines.push(m),
      }),
    )
    expect(lines).toHaveLength(0)
  })

  it('does not fetch within 24h throttle window (cache fresh)', async () => {
    const t = 1_000_000_000_000
    writeCacheAtomic(
      { last_check_ts: t - 60_000, latest_version: '0.2.0' },
      tmpDir,
    )
    const fetchImpl = vi.fn(makeFetchOK('0.4.0'))
    const svc = make({ now: () => t, fetchImpl: fetchImpl as FetchImpl })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        configDir: tmpDir,
      }),
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fetches when cache is stale (>24h) and writes the new latest', async () => {
    const t = 1_000_000_000_000
    const stale = t - 25 * 60 * 60 * 1000
    writeCacheAtomic({ last_check_ts: stale, latest_version: '0.2.0' }, tmpDir)
    const lines: string[] = []
    const svc = make({
      now: () => t,
      fetchImpl: makeFetchOK('0.3.0', 'W/"abc"'),
    })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        configDir: tmpDir,
        emit: (m) => lines.push(m),
      }),
    )
    expect(lines).toHaveLength(0) // silent on the fetching run
    expect(readCache(tmpDir)).toEqual({
      last_check_ts: t,
      latest_version: '0.3.0',
      etag: 'W/"abc"',
    })
  })

  it('handles 304 by preserving cached latest_version', async () => {
    const t = 1_000_000_000_000
    const stale = t - 25 * 60 * 60 * 1000
    writeCacheAtomic(
      { last_check_ts: stale, latest_version: '0.3.0', etag: 'W/"old"' },
      tmpDir,
    )
    const svc = make({ now: () => t, fetchImpl: makeFetch304() })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        configDir: tmpDir,
      }),
    )
    const cache = readCache(tmpDir)
    expect(cache?.latest_version).toBe('0.3.0')
    expect(cache?.etag).toBe('W/"old"')
    expect(cache?.last_check_ts).toBe(t)
  })

  it('still updates last_check_ts on network failure', async () => {
    const t = 1_000_000_000_000
    const svc = make({ now: () => t, fetchImpl: makeFetchBroken() })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        configDir: tmpDir,
      }),
    )
    expect(readCache(tmpDir)?.last_check_ts).toBe(t)
  })

  it('uses env-selected next channel and per-service configDir', async () => {
    const t = 1_000_000_000_000
    const urls: string[] = []
    const fetchImpl: FetchImpl = async (url) => {
      urls.push(url)
      return makeFetchOK('0.4.0')(url)
    }
    const svc = make({ now: () => t, fetchImpl, configDir: tmpDir })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: { MXS_UPDATE_CHANNEL: 'next' },
        force: true,
      }),
    )
    expect(urls[0]).toContain('/next')
    expect(readCache(tmpDir)?.latest_version).toBe('0.4.0')
  })

  it('uses XDG_CONFIG_HOME when no config directory override is supplied', async () => {
    const previous = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = tmpDir
    try {
      const svc = make({
        now: () => 1_000_000_000_000,
        fetchImpl: makeFetchOK('0.4.0'),
      })
      await Effect.runPromise(
        svc.maybeNotify({
          currentVersion: '0.2.0',
          isTTY: true,
          env: {},
          force: true,
        }),
      )
      expect(readCache(path.join(tmpDir, 'mxs'))?.latest_version).toBe('0.4.0')
    } finally {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = previous
    }
  })

  it('returns immediately when notify options request a skip', async () => {
    const fetchImpl = vi.fn(makeFetchOK('0.4.0'))
    const svc = make({ fetchImpl: fetchImpl as FetchImpl })
    await Effect.runPromise(
      svc.maybeNotify({
        currentVersion: '0.2.0',
        isTTY: true,
        env: {},
        quiet: true,
        configDir: tmpDir,
      }),
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(readCache(tmpDir)).toBeNull()
  })

  it('never throws even when the cache dir is unwritable', async () => {
    const svc = make({
      now: () => 1,
      fetchImpl: makeFetchOK('0.3.0'),
    })
    await expect(
      Effect.runPromise(
        svc.maybeNotify({
          currentVersion: '0.2.0',
          isTTY: true,
          env: {},
          configDir: '/dev/null/missing',
        }),
      ),
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// runUpdate — pm detection / engine / spawn outcomes
// ---------------------------------------------------------------------------

describe('runUpdate', () => {
  it('fails UpdateDevEnvironment when running from monorepo source', async () => {
    const svc = make({ fetchImpl: makeFetchOK('9.9.9') })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint: '/repo/packages/cli/src/bin/mxs.ts',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      const err = (exit.cause as any).error ?? (exit.cause as any).failure
      const tag = err?._tag ?? extractTag(exit.cause)
      expect(tag).toBe('UpdateDevEnvironment')
    }
  })

  it('fails UpdatePmUnknown when pm cannot be detected', async () => {
    const svc = make({ fetchImpl: makeFetchOK('9.9.9') })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint: '/some/exotic/path/mxs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdatePmUnknown')
    }
  })

  it('fails UpdateRegistryUnreachable when fetch throws', async () => {
    const svc = make({ fetchImpl: makeFetchBroken() })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdateRegistryUnreachable')
    }
  })

  it('returns up-to-date result without spawning when local >= registry latest', async () => {
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >()
    const svc = make({ fetchImpl: makeFetchOK('0.2.0'), spawnImpl })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(res.upToDate).toBe(true)
    expect(res.upgraded).toBe(false)
    expect(spawnImpl).not.toHaveBeenCalled()
  })

  it('returns dry-run result when --dry-run set', async () => {
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >()
    const svc = make({ fetchImpl: makeFetchOK('9.9.9'), spawnImpl })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        dryRun: true,
        yes: true,
        json: true,
      }),
    )
    expect(res.dryRun).toBe(true)
    expect(res.upgraded).toBe(false)
    expect(res.command).toMatch(/^npm install -g @mx-space\/cli@latest$/)
    expect(spawnImpl).not.toHaveBeenCalled()
  })

  it('emits the exact command for non-json dry-run updates', async () => {
    const lines: string[] = []
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >()
    const svc = make({
      fetchImpl: makeFetchOK('9.9.9'),
      spawnImpl,
      emitInfo: (line) => lines.push(line),
    })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        dryRun: true,
        yes: true,
        json: false,
      }),
    )
    expect(res.command).toBe('npm install -g @mx-space/cli@latest')
    expect(lines.join('\n')).toContain('would run')
    expect(spawnImpl).not.toHaveBeenCalled()
  })

  it('returns check-only result and emits non-json announcement', async () => {
    const lines: string[] = []
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >()
    const svc = make({
      fetchImpl: makeFetchOK('9.9.9'),
      spawnImpl,
      emitInfo: (line) => lines.push(line),
    })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        check: true,
        json: false,
      }),
    )
    expect(res).toMatchObject({ dryRun: true, upToDate: false })
    expect(lines.join('\n')).toContain('0.2.0 → 9.9.9')
    expect(spawnImpl).not.toHaveBeenCalled()
  })

  it('supports --pm override and prerelease channel', async () => {
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >(async () => ({ status: 0, stderr: '' }))
    const svc = make({ fetchImpl: makeFetchOK('9.9.9'), spawnImpl })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint: '/some/exotic/path/mxs',
        pm: 'pnpm',
        prerelease: true,
        yes: true,
        json: true,
      }),
    )
    expect(res.channel).toBe('next')
    expect(res.pm).toBe('pnpm')
    expect(res.command).toBe('pnpm add -g @mx-space/cli@next')
  })

  it('maps unexpected 304 during runUpdate to UpdateRegistryUnreachable', async () => {
    const svc = make({ fetchImpl: makeFetch304() })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdateRegistryUnreachable')
    }
  })

  it('returns cancelled result when interactive confirmation rejects', async () => {
    const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    const stderrTty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })
    const lines: string[] = []
    const svc = make({
      fetchImpl: makeFetchOK('9.9.9'),
      confirmImpl: async () => false,
      emitInfo: (line) => lines.push(line),
    })
    try {
      const res = await Effect.runPromise(
        svc.runUpdate({
          currentVersion: '0.2.0',
          entrypoint:
            '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
          yes: false,
          json: false,
        }),
      )
      expect(res.cancelled).toBe(true)
      expect(lines.join('\n')).toContain('update cancelled')
    } finally {
      if (stdinTty) Object.defineProperty(process.stdin, 'isTTY', stdinTty)
      if (stderrTty) Object.defineProperty(process.stderr, 'isTTY', stderrTty)
    }
  })

  it('maps confirmation and spawn failures to UpdateSpawnFailed', async () => {
    const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    const stderrTty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })
    try {
      const promptSvc = make({
        fetchImpl: makeFetchOK('9.9.9'),
        confirmImpl: async () => {
          throw new Error('prompt failed')
        },
      })
      const promptExit = await Effect.runPromiseExit(
        promptSvc.runUpdate({
          currentVersion: '0.2.0',
          entrypoint:
            '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
          yes: false,
          json: false,
        }),
      )
      expect(promptExit._tag).toBe('Failure')
      if (promptExit._tag === 'Failure') {
        expect(extractTag(promptExit.cause)).toBe('UpdateSpawnFailed')
      }
    } finally {
      if (stdinTty) Object.defineProperty(process.stdin, 'isTTY', stdinTty)
      if (stderrTty) Object.defineProperty(process.stderr, 'isTTY', stderrTty)
    }

    const spawnSvc = make({
      fetchImpl: makeFetchOK('9.9.9'),
      spawnImpl: async () => {
        throw new Error('spawn failed')
      },
    })
    const spawnExit = await Effect.runPromiseExit(
      spawnSvc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(spawnExit._tag).toBe('Failure')
    if (spawnExit._tag === 'Failure') {
      expect(extractTag(spawnExit.cause)).toBe('UpdateSpawnFailed')
    }
  })

  it('maps nonzero non-permission spawn status to UpdateSpawnFailed', async () => {
    const svc = make({
      fetchImpl: makeFetchOK('9.9.9'),
      spawnImpl: async () => ({ status: 2, stderr: 'regular failure' }),
    })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdateSpawnFailed')
    }
  })

  it('maps transient installs to UpdateTransientInstall', async () => {
    const svc = make({ fetchImpl: makeFetchOK('9.9.9') })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/Users/x/.npm/_npx/abc/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdateTransientInstall')
    }
  })

  it('returns upgraded=true on successful spawn', async () => {
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >(async () => ({ status: 0, stderr: '' }))
    const svc = make({ fetchImpl: makeFetchOK('9.9.9'), spawnImpl })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(res.upgraded).toBe(true)
    expect(res.toVersion).toBe('9.9.9')
    expect(spawnImpl).toHaveBeenCalledOnce()
  })

  it('emits restart guidance after a non-json successful spawn', async () => {
    const lines: string[] = []
    const spawnImpl = vi.fn<
      (cmd: string, args: string[]) => Promise<SpawnUpgradeResult>
    >(async () => ({ status: 0, stderr: '' }))
    const svc = make({
      fetchImpl: makeFetchOK('9.9.9'),
      spawnImpl,
      emitInfo: (line) => lines.push(line),
    })
    const res = await Effect.runPromise(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: false,
      }),
    )
    expect(res.upgraded).toBe(true)
    expect(lines.join('\n')).toContain('Restart any long-running mxs process')
  })

  it('maps EACCES stderr to UpdatePermissionDenied', async () => {
    const spawnImpl = async () => ({
      status: 1,
      stderr: 'npm ERR! Error: EACCES: permission denied',
    })
    const svc = make({ fetchImpl: makeFetchOK('9.9.9'), spawnImpl })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdatePermissionDenied')
    }
  })

  it('fails UpdateNodeIncompatible when registry engine excludes current node', async () => {
    const svc = make({
      fetchImpl: makeFetchOKWithEngine('9.9.9', '>=99'),
    })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        nodeVersion: '22.0.0',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdateNodeIncompatible')
    }
  })

  it('rejects unknown --pm override with UpdatePmUnknown', async () => {
    const svc = make({ fetchImpl: makeFetchOK('9.9.9') })
    const exit = await Effect.runPromiseExit(
      svc.runUpdate({
        currentVersion: '0.2.0',
        entrypoint:
          '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
        pm: 'snap',
        yes: true,
        json: true,
      }),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(extractTag(exit.cause)).toBe('UpdatePmUnknown')
    }
  })
})

describe('UpdateNotifier layer', () => {
  it('provides a service through the exported layer factory', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const notifier = yield* UpdateNotifier
        return typeof notifier.maybeNotify
      }).pipe(Effect.provide(updateNotifierLayer())),
    )
    expect(result).toBe('function')
  })
})

// extract a TaggedError tag from an Effect Cause without depending on internals
function extractTag(cause: unknown): string | undefined {
  const seen = new Set<unknown>()
  const visit = (node: unknown): string | undefined => {
    if (!node || typeof node !== 'object' || seen.has(node)) return undefined
    seen.add(node)
    const obj = node as Record<string, unknown>
    if (typeof obj._tag === 'string' && obj._tag.startsWith('Update'))
      return obj._tag as string
    if (typeof obj._tag === 'string' && /^(Update|Auth|Validation|Resource|Server|Network|Config|Profile|Argv|Generic|Write)/.test(obj._tag as string))
      return obj._tag as string
    for (const v of Object.values(obj)) {
      const t = visit(v)
      if (t) return t
    }
    return undefined
  }
  return visit(cause)
}

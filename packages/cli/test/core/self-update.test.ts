import { describe, expect, it } from 'vitest'

import {
  buildUpgradeCommand,
  compareSemver,
  detectPackageManager,
  fetchLatestVersion,
  type FetchImpl,
  satisfiesNodeEngine,
} from '../../src/core/self-update'

describe('detectPackageManager', () => {
  it('detects npm Linux global install', () => {
    const res = detectPackageManager(
      '/usr/local/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('global')
    if (res.kind === 'global') expect(res.pm).toBe('npm')
  })

  it('detects npm macOS homebrew install', () => {
    const res = detectPackageManager(
      '/opt/homebrew/lib/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
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

  it('detects pnpm Linux XDG global', () => {
    const res = detectPackageManager(
      '/home/x/.local/share/pnpm/global/5/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
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
    const res = detectPackageManager(
      '/repo/packages/cli/src/bin/mxs.ts',
    )
    expect(res.kind).toBe('dev')
    if (res.kind === 'dev') expect(res.reason).toBe('monorepo-source')
  })

  it('detects monorepo dev dist', () => {
    const res = detectPackageManager(
      '/repo/packages/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('dev')
    if (res.kind === 'dev') expect(res.reason).toBe('monorepo-dist')
  })

  it('detects npx transient cache', () => {
    const res = detectPackageManager(
      '/Users/x/.npm/_npx/abc/node_modules/@mx-space/cli/dist/bin/mxs.mjs',
    )
    expect(res.kind).toBe('transient')
    if (res.kind === 'transient') expect(res.cache).toBe('npx')
  })

  it('detects Windows npm install', () => {
    const res = detectPackageManager(
      'C:\\Users\\x\\AppData\\Roaming\\npm\\node_modules\\@mx-space\\cli\\dist\\bin\\mxs.mjs',
    )
    expect(res.kind).toBe('global')
    if (res.kind === 'global') expect(res.pm).toBe('npm')
  })

  it('returns unknown when nothing matches', () => {
    const res = detectPackageManager('/some/exotic/path/mxs')
    expect(res.kind).toBe('unknown')
  })
})

describe('compareSemver', () => {
  it('orders patch versions', () => {
    expect(compareSemver('0.2.0', '0.2.1')).toBe(-1)
    expect(compareSemver('0.2.1', '0.2.0')).toBe(1)
    expect(compareSemver('0.2.0', '0.2.0')).toBe(0)
  })

  it('orders minor versions', () => {
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1)
  })

  it('orders prerelease less than release', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBe(1)
  })

  it('orders prerelease tags', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1)
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
  })
})

describe('buildUpgradeCommand', () => {
  it('builds npm latest', () => {
    expect(buildUpgradeCommand('npm', 'stable')).toEqual({
      cmd: 'npm',
      args: ['install', '-g', '@mx-space/cli@latest'],
    })
  })

  it('builds pnpm latest', () => {
    expect(buildUpgradeCommand('pnpm', 'stable')).toEqual({
      cmd: 'pnpm',
      args: ['add', '-g', '@mx-space/cli@latest'],
    })
  })

  it('builds yarn latest', () => {
    expect(buildUpgradeCommand('yarn', 'stable')).toEqual({
      cmd: 'yarn',
      args: ['global', 'add', '@mx-space/cli@latest'],
    })
  })

  it('builds bun latest', () => {
    expect(buildUpgradeCommand('bun', 'stable')).toEqual({
      cmd: 'bun',
      args: ['add', '-g', '@mx-space/cli@latest'],
    })
  })

  it('uses @next for prerelease channel', () => {
    expect(buildUpgradeCommand('npm', 'next').args).toContain('@mx-space/cli@next')
    expect(buildUpgradeCommand('pnpm', 'next').args).toContain('@mx-space/cli@next')
  })
})

describe('satisfiesNodeEngine', () => {
  it('accepts >=N when current is greater', () => {
    expect(satisfiesNodeEngine('22.5.0', '>=22')).toBe(true)
    expect(satisfiesNodeEngine('22.5.0', '>=22.0.0')).toBe(true)
  })

  it('rejects >=N when current is lower', () => {
    expect(satisfiesNodeEngine('20.5.0', '>=22')).toBe(false)
  })

  it('caret pins on major', () => {
    expect(satisfiesNodeEngine('22.5.0', '^22.0.0')).toBe(true)
    expect(satisfiesNodeEngine('23.0.0', '^22.0.0')).toBe(false)
  })

  it('accepts bare major match', () => {
    expect(satisfiesNodeEngine('22.5.0', '22.x')).toBe(true)
    expect(satisfiesNodeEngine('23.0.0', '22.x')).toBe(false)
  })

  it('evaluates disjunctions across all comparators', () => {
    expect(satisfiesNodeEngine('22.0.0', '^20.0.0 || >=22.0.0')).toBe(true)
  })

  it('evaluates multi-comparator upper bounds', () => {
    expect(satisfiesNodeEngine('23.9.0', '>=22 <24')).toBe(true)
    expect(satisfiesNodeEngine('24.0.0', '>=22 <24')).toBe(false)
  })

  it('returns true when range is unrecognized (conservative)', () => {
    expect(satisfiesNodeEngine('22.5.0', 'lts/*')).toBe(true)
  })

  it('returns true when range is empty', () => {
    expect(satisfiesNodeEngine('22.5.0', undefined)).toBe(true)
  })
})

describe('fetchLatestVersion', () => {
  function makeFetch(
    body: unknown,
    headers: Record<string, string> = {},
    status = 200,
  ): FetchImpl {
    return async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get(name: string) {
          return headers[name.toLowerCase()] ?? null
        },
      },
      async json() {
        return body
      },
      async text() {
        return JSON.stringify(body)
      },
    })
  }

  it('returns the latest version', async () => {
    const fetchImpl = makeFetch(
      { version: '0.3.0', engines: { node: '>=22' }, dist: { tarball: 'https://x' } },
      { etag: 'W/"abc"' },
    )
    const hit = await fetchLatestVersion('stable', { fetchImpl })
    expect('notModified' in hit).toBe(false)
    if (!('notModified' in hit) || !hit.notModified) {
      expect(hit.version).toBe('0.3.0')
      expect(hit.engines?.node).toBe('>=22')
      expect(hit.etag).toBe('W/"abc"')
    }
  })

  it('honors 304 not-modified', async () => {
    const fetchImpl = makeFetch({}, {}, 304)
    const hit = await fetchLatestVersion('stable', { fetchImpl, etag: 'W/"abc"' })
    expect('notModified' in hit && hit.notModified).toBe(true)
  })

  it('throws on non-2xx', async () => {
    const fetchImpl = makeFetch({}, {}, 500)
    await expect(fetchLatestVersion('stable', { fetchImpl })).rejects.toThrow(
      /status 500/,
    )
  })
})

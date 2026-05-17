import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  runLegacyMigrationIfNeeded,
  type MigrationResult,
} from '../../src/core/migration'
import { getProfilesDir } from '../../src/core/profile'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-migration-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (origXdg === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = origXdg
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// Helpers
function mxsDir(): string {
  return path.join(tmpDir, 'mxs')
}

async function stageLegacyConfig(data: object): Promise<void> {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(
    path.join(mxsDir(), 'config.json'),
    JSON.stringify(data, null, 2),
  )
}

async function stageLegacyCredentials(data: object): Promise<void> {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(
    path.join(mxsDir(), 'credentials.json'),
    JSON.stringify(data, null, 2),
  )
}

async function legacyConfigExists(): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'config.json'))
    return true
  } catch {
    return false
  }
}

async function legacyCredentialsExists(): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'credentials.json'))
    return true
  } catch {
    return false
  }
}

async function readProfileConfig(name: string): Promise<any> {
  const p = path.join(mxsDir(), 'profiles', name, 'config.json')
  return JSON.parse(await fs.readFile(p, 'utf8'))
}

async function readProfileCredentials(name: string): Promise<any> {
  const p = path.join(mxsDir(), 'profiles', name, 'credentials.json')
  return JSON.parse(await fs.readFile(p, 'utf8'))
}

async function profileCredentialsExists(name: string): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'profiles', name, 'credentials.json'))
    return true
  } catch {
    return false
  }
}

async function readCurrentFile(): Promise<string> {
  return (await fs.readFile(path.join(mxsDir(), 'current'), 'utf8')).trim()
}

describe('no-op when no legacy files', () => {
  it('returns null and touches nothing when XDG dir is empty', async () => {
    const result = await runLegacyMigrationIfNeeded({ isTTY: false, report: null })
    expect(result).toBeNull()
    // The mxs dir should not have been created at all
    const entries = await fs.readdir(tmpDir)
    expect(entries).toHaveLength(0)
  })

  it('returns null when mxs dir exists but no legacy files', async () => {
    await fs.mkdir(mxsDir(), { recursive: true })
    const result = await runLegacyMigrationIfNeeded({ isTTY: false, report: null })
    expect(result).toBeNull()
  })
})

describe('full migration — TTY says production=true', () => {
  it('migrates config and credentials, marks production=true', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })
    await stageLegacyCredentials({ access_token: 'tok-abc', expires_at: 9999 })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: true,
      promptIsProduction: async () => true,
      report: null,
    })

    expect(result).toMatchObject<MigrationResult>({
      profile: 'default',
      production: true,
      cleanedStaleLegacy: false,
    })

    // Profile config written with production=true
    const cfg = await readProfileConfig('default')
    expect(cfg.api_url).toBe('https://blog.example.com')
    expect(cfg.production).toBe(true)

    // Profile credentials written
    const creds = await readProfileCredentials('default')
    expect(creds.access_token).toBe('tok-abc')

    // Legacy files gone
    expect(await legacyConfigExists()).toBe(false)
    expect(await legacyCredentialsExists()).toBe(false)

    // current file set to 'default'
    expect(await readCurrentFile()).toBe('default')
  })
})

describe('full migration — TTY says production=false', () => {
  it('migrates without production flag, leaves production absent', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })
    await stageLegacyCredentials({ access_token: 'tok-xyz', expires_at: 1000 })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: true,
      promptIsProduction: async () => false,
      report: null,
    })

    expect(result).toMatchObject<MigrationResult>({
      profile: 'default',
      production: false,
      cleanedStaleLegacy: false,
    })

    const cfg = await readProfileConfig('default')
    // production must NOT be true
    expect(cfg.production).not.toBe(true)
  })
})

describe('full migration — non-TTY', () => {
  it('skips prompt, completes silently with production=false', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })
    await stageLegacyCredentials({ access_token: 'tok-nonTTY', expires_at: 1 })

    const promptSpy = vi.fn()

    const result = await runLegacyMigrationIfNeeded({
      isTTY: false,
      promptIsProduction: promptSpy,
      report: null,
    })

    expect(promptSpy).not.toHaveBeenCalled()
    expect(result?.production).toBe(false)
    expect(result?.profile).toBe('default')

    expect(await legacyConfigExists()).toBe(false)
    expect(await legacyCredentialsExists()).toBe(false)
    expect(await readCurrentFile()).toBe('default')
  })
})

describe('full migration — only config.json (no credentials)', () => {
  it('migrates without credentials file, no error', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: null,
    })

    expect(result?.profile).toBe('default')
    expect(await legacyConfigExists()).toBe(false)

    const cfg = await readProfileConfig('default')
    expect(cfg.api_url).toBe('https://blog.example.com')

    // credentials file should NOT be present
    expect(await profileCredentialsExists('default')).toBe(false)
  })
})

describe('full migration — only credentials.json (no config)', () => {
  it('migrates credentials only, skips config write gracefully', async () => {
    await stageLegacyCredentials({ access_token: 'tok-only-creds', expires_at: 5000 })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: null,
    })

    expect(result?.profile).toBe('default')
    expect(await legacyCredentialsExists()).toBe(false)

    // credentials written
    const creds = await readProfileCredentials('default')
    expect(creds.access_token).toBe('tok-only-creds')
  })
})

describe('stale-legacy cleanup', () => {
  it('removes legacy files when profiles/ dir already exists, returns cleanedStaleLegacy=true', async () => {
    // Pre-stage an existing profile
    const existingDir = path.join(mxsDir(), 'profiles', 'some-existing')
    await fs.mkdir(existingDir, { recursive: true })
    await fs.writeFile(
      path.join(existingDir, 'config.json'),
      JSON.stringify({ api_url: 'https://existing.example.com' }),
    )

    // Stage legacy files that shouldn't exist alongside profiles/
    await stageLegacyConfig({ api_url: 'https://stale.example.com' })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: null,
    })

    expect(result).toMatchObject<MigrationResult>({
      profile: '',
      production: false,
      cleanedStaleLegacy: true,
    })

    // Legacy file removed
    expect(await legacyConfigExists()).toBe(false)

    // Existing profile untouched
    const existingCfg = JSON.parse(
      await fs.readFile(path.join(existingDir, 'config.json'), 'utf8'),
    )
    expect(existingCfg.api_url).toBe('https://existing.example.com')

    // current file NOT written (not our place to set it)
    try {
      await fs.stat(path.join(mxsDir(), 'current'))
      expect.fail('current file should not have been created in stale-cleanup branch')
    } catch (e: any) {
      expect(e.code).toBe('ENOENT')
    }
  })

  it('removes both legacy files when both are stale', async () => {
    await fs.mkdir(path.join(mxsDir(), 'profiles', 'dev'), { recursive: true })
    await stageLegacyConfig({ api_url: 'https://stale.example.com' })
    await stageLegacyCredentials({ access_token: 'stale-tok', expires_at: 0 })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: null,
    })

    expect(result?.cleanedStaleLegacy).toBe(true)
    expect(await legacyConfigExists()).toBe(false)
    expect(await legacyCredentialsExists()).toBe(false)
  })
})

describe('idempotency', () => {
  it('second call returns null after successful migration', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })
    await stageLegacyCredentials({ access_token: 'tok-idem', expires_at: 1 })

    const first = await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: null,
    })
    expect(first?.profile).toBe('default')

    const second = await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: null,
    })
    expect(second).toBeNull()
  })
})

describe('report suppression', () => {
  it('report: null suppresses all output', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })

    const reportSpy = vi.fn()
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    try {
      await runLegacyMigrationIfNeeded({
        isTTY: false,
        report: null,
      })
    } finally {
      stderrSpy.mockRestore()
    }

    expect(reportSpy).not.toHaveBeenCalled()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('report callback receives the status line', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })

    const lines: string[] = []
    await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: (line) => lines.push(line),
    })

    expect(lines.some((l) => l.includes("migrated single-profile config to profile 'default'"))).toBe(true)
  })

  it('stale-cleanup emits a warning via report', async () => {
    await fs.mkdir(path.join(mxsDir(), 'profiles', 'dev'), { recursive: true })
    await stageLegacyConfig({ api_url: 'https://stale.example.com' })

    const lines: string[] = []
    await runLegacyMigrationIfNeeded({
      isTTY: false,
      report: (line) => lines.push(line),
    })

    expect(lines.some((l) => l.includes('stale legacy config files'))).toBe(true)
  })
})

describe('promptIsProduction cancellation', () => {
  it('treats a falsy return (simulate cancel) as no and completes successfully', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })

    const result = await runLegacyMigrationIfNeeded({
      isTTY: true,
      promptIsProduction: async () => false,
      report: null,
    })

    expect(result?.production).toBe(false)
    expect(result?.profile).toBe('default')
    expect(await legacyConfigExists()).toBe(false)
  })
})

describe('file mode preservation', () => {
  it('profile dir has mode 0700', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })

    await runLegacyMigrationIfNeeded({ isTTY: false, report: null })

    const stat = await fs.stat(path.join(mxsDir(), 'profiles', 'default'))
    expect(stat.mode & 0o777).toBe(0o700)
  })

  it('credentials.json has mode 0600', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })
    await stageLegacyCredentials({ access_token: 'tok', expires_at: 0 })

    await runLegacyMigrationIfNeeded({ isTTY: false, report: null })

    const stat = await fs.stat(path.join(mxsDir(), 'profiles', 'default', 'credentials.json'))
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('config.json has mode 0644', async () => {
    await stageLegacyConfig({ api_url: 'https://blog.example.com' })

    await runLegacyMigrationIfNeeded({ isTTY: false, report: null })

    const stat = await fs.stat(path.join(mxsDir(), 'profiles', 'default', 'config.json'))
    expect(stat.mode & 0o777).toBe(0o644)
  })
})

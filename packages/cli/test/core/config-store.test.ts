import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  enforceCredentialsMode,
  normalizeApiUrl,
  resolveConfig,
} from '../../src/core/config-store'
import {
  writeProfileConfig,
  writeProfileCredentials,
  getProfilesDir,
} from '../../src/core/profile'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-cfg-'))
  process.env.XDG_CONFIG_HOME = tmpDir
  delete process.env.MXS_API_URL
  delete process.env.MXS_TOKEN
  delete process.env.MXS_API_KEY
  delete process.env.MXS_PROFILE
})

afterEach(async () => {
  delete process.env.XDG_CONFIG_HOME
  delete process.env.MXS_API_URL
  delete process.env.MXS_TOKEN
  delete process.env.MXS_API_KEY
  delete process.env.MXS_PROFILE
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('normalizeApiUrl', () => {
  it('strips trailing slash', () => {
    expect(normalizeApiUrl('https://blog.example.com/')).toBe(
      'https://blog.example.com',
    )
  })
  it('adds https for remote hosts', () => {
    expect(normalizeApiUrl('blog.example.com')).toBe('https://blog.example.com')
  })
  it('adds http for localhost', () => {
    expect(normalizeApiUrl('localhost:3000')).toBe('http://localhost:3000')
  })
})

describe('resolveConfig — no profile configured', () => {
  it('throws when api_url missing and no profile active', async () => {
    await expect(resolveConfig()).rejects.toThrow(/API URL/)
  })

  it('reads MXS_API_URL env', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    const r = await resolveConfig()
    expect(r.apiUrl).toBe('https://x.example.com')
    expect(r.apiBase).toBe('https://x.example.com/api/v2')
    expect(r.authBase).toBe('https://x.example.com/api/v2/auth')
    expect(r.urlOverridden).toBe(true)
    expect(r.profileExplicit).toBe(false)
  })

  it('respects --api-url flag override over env', async () => {
    process.env.MXS_API_URL = 'https://env.example.com'
    const r = await resolveConfig({ apiUrl: 'https://flag.example.com' })
    expect(r.apiUrl).toBe('https://flag.example.com')
    expect(r.urlOverridden).toBe(true)
  })

  it('reads token from MXS_TOKEN env', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    process.env.MXS_TOKEN = 'abc'
    const r = await resolveConfig()
    expect(r.token).toBe('abc')
  })

  it('reads api key from MXS_API_KEY env', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    process.env.MXS_API_KEY = 'txo-secret'
    const r = await resolveConfig()
    expect(r.apiKey).toBe('txo-secret')
  })

  it('respects api key flag override', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    process.env.MXS_API_KEY = 'txo-env'
    const r = await resolveConfig({ apiKey: 'txo-flag' })
    expect(r.apiKey).toBe('txo-flag')
  })
})

describe('resolveConfig — profile-aware resolution', () => {
  it('reads api_url from active profile via MXS_PROFILE', async () => {
    await writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
    process.env.MXS_PROFILE = 'dev'
    const r = await resolveConfig()
    expect(r.apiUrl).toBe('https://dev.example.com')
    expect(r.profileName).toBe('dev')
    expect(r.profileExplicit).toBe(true)
    expect(r.urlOverridden).toBe(false)
  })

  it('reads api_url from active profile via --profile flag', async () => {
    await writeProfileConfig('staging', {
      api_url: 'https://staging.example.com',
    })
    const r = await resolveConfig({ profile: 'staging' })
    expect(r.apiUrl).toBe('https://staging.example.com')
    expect(r.profileName).toBe('staging')
    expect(r.profileExplicit).toBe(true)
  })

  it('reads api_url from current profile file', async () => {
    await writeProfileConfig('prod', {
      api_url: 'https://prod.example.com',
      production: true,
    })
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'prod\n')
    const r = await resolveConfig()
    expect(r.apiUrl).toBe('https://prod.example.com')
    expect(r.profileName).toBe('prod')
    expect(r.profileExplicit).toBe(false)
    expect(r.isProduction).toBe(true)
  })

  it('token comes from profile credentials when no url override', async () => {
    await writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
    await writeProfileCredentials('dev', {
      access_token: 'profile-token-xyz',
      expires_at: Date.now() + 3600_000,
    })
    process.env.MXS_PROFILE = 'dev'
    const r = await resolveConfig()
    expect(r.token).toBe('profile-token-xyz')
  })

  it('isProduction false for non-production profile', async () => {
    await writeProfileConfig('dev', {
      api_url: 'https://dev.example.com',
      production: false,
    })
    process.env.MXS_PROFILE = 'dev'
    const r = await resolveConfig()
    expect(r.isProduction).toBe(false)
  })

  it('isProduction true when profile has production=true', async () => {
    await writeProfileConfig('prod', {
      api_url: 'https://prod.example.com',
      production: true,
    })
    process.env.MXS_PROFILE = 'prod'
    const r = await resolveConfig()
    expect(r.isProduction).toBe(true)
  })

  it('flag override takes precedence over env profile over current file', async () => {
    await writeProfileConfig('flag-profile', {
      api_url: 'https://flag.example.com',
    })
    await writeProfileConfig('env-profile', {
      api_url: 'https://env.example.com',
    })
    await writeProfileConfig('file-profile', {
      api_url: 'https://file.example.com',
    })
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'file-profile\n')
    process.env.MXS_PROFILE = 'env-profile'
    const r = await resolveConfig({ profile: 'flag-profile' })
    expect(r.profileName).toBe('flag-profile')
    expect(r.apiUrl).toBe('https://flag.example.com')
  })
})

describe('resolveConfig — URL-override mode decouples credentials', () => {
  it('does NOT read profile credentials when --api-url is set', async () => {
    await writeProfileConfig('prod', {
      api_url: 'https://prod.example.com',
      production: true,
    })
    await writeProfileCredentials('prod', {
      access_token: 'fixture',
      expires_at: Date.now() + 3600_000,
    })
    process.env.MXS_PROFILE = 'prod'
    const r = await resolveConfig({ apiUrl: 'https://custom.example.com' })
    expect(r.urlOverridden).toBe(true)
    expect(r.token).toBeUndefined()
  })

  it('uses explicit credential override even in url-overridden mode', async () => {
    const r = await resolveConfig({
      apiUrl: 'https://custom.example.com',
      token: 'fixture',
    })
    expect(r.token).toBe('fixture')
  })

  it('uses MXS_TOKEN in url-overridden mode but not profile creds', async () => {
    await writeProfileConfig('prod', {
      api_url: 'https://prod.example.com',
      production: true,
    })
    await writeProfileCredentials('prod', {
      access_token: 'should-not-appear',
      expires_at: Date.now() + 3600_000,
    })
    process.env.MXS_PROFILE = 'prod'
    process.env.MXS_TOKEN = 'env-override-token'
    const r = await resolveConfig({ apiUrl: 'https://custom.example.com' })
    expect(r.token).toBe('env-override-token')
    expect(r.token).not.toBe('should-not-appear')
  })

  it('isProduction is false in url-overridden mode', async () => {
    await writeProfileConfig('prod', {
      api_url: 'https://prod.example.com',
      production: true,
    })
    process.env.MXS_PROFILE = 'prod'
    const r = await resolveConfig({ apiUrl: 'https://custom.example.com' })
    expect(r.isProduction).toBe(false)
  })
})

describe('resolveConfig — new resolved fields', () => {
  it('profileName is null when no profile configured', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    const r = await resolveConfig()
    expect(r.profileName).toBeNull()
  })

  it('profileExplicit is true via MXS_PROFILE', async () => {
    await writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
    process.env.MXS_PROFILE = 'dev'
    const r = await resolveConfig()
    expect(r.profileExplicit).toBe(true)
  })

  it('profileExplicit is false when only current file sets profile', async () => {
    await writeProfileConfig('prod', { api_url: 'https://prod.example.com' })
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'prod\n')
    const r = await resolveConfig()
    expect(r.profileExplicit).toBe(false)
  })

  it('urlOverridden is false when api_url from profile', async () => {
    await writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
    process.env.MXS_PROFILE = 'dev'
    const r = await resolveConfig()
    expect(r.urlOverridden).toBe(false)
  })
})

describe('resolveConfig — profile.not_found', () => {
  it('throws profile.not_found when current points to a non-existent profile dir', async () => {
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'ghost\n')
    await expect(resolveConfig()).rejects.toMatchObject({
      code: 'profile.not_found',
    })
  })

  it('throws profile.not_found with a helpful hint', async () => {
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'ghost\n')
    const err: any = await resolveConfig().catch((e) => e)
    expect(err.hint).toMatch(/mxs profile ls/)
    expect(err.hint).toMatch(/mxs auth login --profile/)
  })

  it('does NOT throw profile.not_found in url-override mode even with stale current pointer', async () => {
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'ghost\n')
    const r = await resolveConfig({ apiUrl: 'https://custom.example.com' })
    expect(r.urlOverridden).toBe(true)
    expect(r.apiUrl).toBe('https://custom.example.com')
  })
})

describe('enforceCredentialsMode', () => {
  it('returns false when file absent', async () => {
    const p = path.join(tmpDir, 'absent.json')
    expect(await enforceCredentialsMode(p)).toBe(false)
  })
  it('chmods to 0600 when mode is wider', async () => {
    const p = path.join(tmpDir, 'creds.json')
    await fs.writeFile(p, '{}', { mode: 0o644 })
    const fixed = await enforceCredentialsMode(p)
    expect(fixed).toBe(true)
    const s = await fs.stat(p)
    expect(s.mode & 0o777).toBe(0o600)
  })
})

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  enforceCredentialsMode,
  normalizeApiUrl,
  resolveConfig,
} from '../../src/core/config-store'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-cfg-'))
  process.env.XDG_CONFIG_HOME = tmpDir
  delete process.env.MXS_API_URL
  delete process.env.MXS_TOKEN
  delete process.env.MXS_API_KEY
})

afterEach(async () => {
  delete process.env.XDG_CONFIG_HOME
  delete process.env.MXS_API_KEY
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

describe('resolveConfig', () => {
  it('throws when api_url missing', async () => {
    await expect(resolveConfig()).rejects.toThrow(/API URL/)
  })
  it('reads MXS_API_URL env', async () => {
    process.env.MXS_API_URL = 'https://x.example.com'
    const r = await resolveConfig()
    expect(r.apiUrl).toBe('https://x.example.com')
    expect(r.apiBase).toBe('https://x.example.com/api/v2')
    expect(r.authBase).toBe('https://x.example.com/api/v2/auth')
  })
  it('respects flag override', async () => {
    process.env.MXS_API_URL = 'https://env.example.com'
    const r = await resolveConfig({ apiUrl: 'https://flag.example.com' })
    expect(r.apiUrl).toBe('https://flag.example.com')
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

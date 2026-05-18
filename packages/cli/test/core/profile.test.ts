import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getCurrentProfile,
  getProfileConfigPath,
  getProfileCredentialsPath,
  getProfileDir,
  getProfilesDir,
  listProfiles,
  readProfileConfig,
  readProfileCredentials,
  removeProfile,
  setCurrentProfile,
  validateProfileName,
  writeProfileConfig,
  writeProfileCredentials,
} from '../../src/core/profile'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-profile-'))
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

describe('validateProfileName', () => {
  it.each([
    'default',
    'dev',
    'prod',
    'my-blog',
    'my_blog',
    'abc123',
    'a',
    'a'.repeat(32),
  ])('accepts valid name: %s', (name) => {
    expect(() => validateProfileName(name)).not.toThrow()
  })

  it.each([
    ['current', 'reserved'],
    ['', 'empty'],
    ['Current', 'uppercase'],
    ['PROD', 'uppercase'],
    ['my blog', 'space'],
    ['my/blog', 'slash'],
    ['a'.repeat(33), 'too long'],
    ['a.b', 'dot'],
  ])('rejects invalid name: %s (%s)', (name) => {
    expect(() => validateProfileName(name)).toThrow()
  })
})

describe('path helpers', () => {
  it('getProfilesDir is under config dir', () => {
    const dir = getProfilesDir()
    expect(dir).toContain('mxs')
    expect(dir).toContain('profiles')
  })

  it('getProfileDir includes name', () => {
    expect(getProfileDir('prod')).toContain('prod')
  })

  it('getProfileConfigPath ends in config.json', () => {
    expect(getProfileConfigPath('dev')).toMatch(/config\.json$/)
  })

  it('getProfileCredentialsPath ends in credentials.json', () => {
    expect(getProfileCredentialsPath('dev')).toMatch(/credentials\.json$/)
  })
})

describe('listProfiles', () => {
  it('returns empty when profiles dir absent', async () => {
    expect(await listProfiles()).toEqual([])
  })

  it('lists profile directories', async () => {
    const profiles = getProfilesDir()
    await fs.mkdir(path.join(profiles, 'dev'), { recursive: true })
    await fs.mkdir(path.join(profiles, 'prod'), { recursive: true })
    const result = await listProfiles()
    expect(result).toEqual(['dev', 'prod'])
  })

  it('ignores hidden directories', async () => {
    const profiles = getProfilesDir()
    await fs.mkdir(path.join(profiles, 'dev'), { recursive: true })
    await fs.mkdir(path.join(profiles, '.hidden'), { recursive: true })
    const result = await listProfiles()
    expect(result).toEqual(['dev'])
  })

  it('ignores non-directory entries (files)', async () => {
    const profiles = getProfilesDir()
    await fs.mkdir(profiles, { recursive: true })
    await fs.mkdir(path.join(profiles, 'dev'), { recursive: true })
    await fs.writeFile(path.join(profiles, 'readme.txt'), 'hello')
    const result = await listProfiles()
    expect(result).toEqual(['dev'])
  })
})

describe('getCurrentProfile', () => {
  it('returns null when current file absent', async () => {
    expect(await getCurrentProfile()).toBeNull()
  })

  it('returns trimmed name from current file', async () => {
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), 'prod\n')
    expect(await getCurrentProfile()).toBe('prod')
  })

  it('returns null when current file is empty/whitespace', async () => {
    const mxsDir = path.join(tmpDir, 'mxs')
    await fs.mkdir(mxsDir, { recursive: true })
    await fs.writeFile(path.join(mxsDir, 'current'), '   \n')
    expect(await getCurrentProfile()).toBeNull()
  })
})

describe('setCurrentProfile', () => {
  it('writes profile name to current file', async () => {
    const profiles = getProfilesDir()
    await fs.mkdir(path.join(profiles, 'dev'), { recursive: true })
    await setCurrentProfile('dev')
    expect(await getCurrentProfile()).toBe('dev')
  })

  it('throws when profile dir does not exist', async () => {
    await expect(setCurrentProfile('nonexistent')).rejects.toMatchObject({
      code: 'validation.failed',
    })
  })

  it('rejects reserved name', async () => {
    await expect(setCurrentProfile('current')).rejects.toMatchObject({
      code: 'validation.failed',
    })
  })

  it('rejects invalid name', async () => {
    await expect(setCurrentProfile('Has Spaces')).rejects.toMatchObject({
      code: 'validation.failed',
    })
  })
})

describe('readProfileConfig / writeProfileConfig', () => {
  it('round-trips config data', async () => {
    await writeProfileConfig('dev', {
      api_url: 'https://dev.example.com',
      api_version: 2,
    })
    const result = await readProfileConfig('dev')
    expect(result.api_url).toBe('https://dev.example.com')
    expect(result.api_version).toBe(2)
  })

  it('returns empty object when config does not exist', async () => {
    await fs.mkdir(getProfileDir('empty'), { recursive: true })
    expect(await readProfileConfig('empty')).toEqual({})
  })

  it('creates profile dir with mode 0700', async () => {
    await writeProfileConfig('newprofile', { api_url: 'https://x.example.com' })
    const stat = await fs.stat(getProfileDir('newprofile'))
    expect(stat.mode & 0o777).toBe(0o700)
  })

  it('writes config.json with mode 0644', async () => {
    await writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
    const stat = await fs.stat(getProfileConfigPath('dev'))
    expect(stat.mode & 0o777).toBe(0o644)
  })

  it('includes production flag', async () => {
    await writeProfileConfig('prod', {
      api_url: 'https://prod.example.com',
      production: true,
    })
    const result = await readProfileConfig('prod')
    expect(result.production).toBe(true)
  })
})

describe('readProfileCredentials / writeProfileCredentials', () => {
  it('round-trips credentials', async () => {
    const creds = {
      access_token: 'tok-abc',
      expires_at: Date.now() + 3600_000,
    }
    await writeProfileCredentials('dev', creds)
    const result = await readProfileCredentials('dev')
    expect(result?.access_token).toBe('tok-abc')
  })

  it('returns null when credentials file absent', async () => {
    await fs.mkdir(getProfileDir('empty'), { recursive: true })
    expect(await readProfileCredentials('empty')).toBeNull()
  })

  it('writes credentials.json with mode 0600', async () => {
    await writeProfileCredentials('dev', {
      access_token: 't',
      expires_at: 0,
    })
    const stat = await fs.stat(getProfileCredentialsPath('dev'))
    expect(stat.mode & 0o777).toBe(0o600)
  })
})

describe('removeProfile', () => {
  it('removes an existing profile directory', async () => {
    await writeProfileConfig('dev', { api_url: 'https://dev.example.com' })
    await removeProfile('dev')
    const result = await listProfiles()
    expect(result).not.toContain('dev')
  })

  it('throws resource.not_found for missing profile', async () => {
    await expect(removeProfile('ghost')).rejects.toMatchObject({
      code: 'resource.not_found',
    })
  })
})

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OutputOptions } from '../../../src/core/output'

const mocks = vi.hoisted(() => ({
  resolveContext: vi.fn(),
  requestDeviceCode: vi.fn(),
  pollDeviceToken: vi.fn(),
  open: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/commands/internal/shared', () => ({
  resolveContext: mocks.resolveContext,
}))

vi.mock('../../../src/core/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/core/auth')>()
  return {
    ...original,
    requestDeviceCode: mocks.requestDeviceCode,
    pollDeviceToken: mocks.pollDeviceToken,
  }
})

vi.mock('open', () => ({ default: mocks.open }))

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-login-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir

  mocks.resolveContext.mockResolvedValue({
    apiUrl: 'https://blog.example.com',
    apiBase: 'https://blog.example.com/api/v2',
    authBase: 'https://blog.example.com/api/v2/auth',
    apiVersion: 2,
    clientId: 'mxs-cli',
    token: undefined,
    configPath: '/tmp/c',
    credentialsPath: '/tmp/k',
    profileName: null,
    isProduction: false,
    profileExplicit: false,
    urlOverridden: false,
  })

  mocks.requestDeviceCode.mockResolvedValue({
    device_code: 'dcode',
    user_code: 'ABCD-1234',
    verification_uri: 'https://blog.example.com/api/v2/auth/device',
    verification_uri_complete: 'https://blog.example.com/api/v2/auth/device?code=ABCD-1234',
    expires_in: 300,
    interval: 1,
  })

  mocks.pollDeviceToken.mockResolvedValue({
    access_token: 'new-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    user: { id: 'u1', email: 'owner@example.com', name: 'Owner' },
  })
})

afterEach(async () => {
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = origXdg
  await fs.rm(tmpDir, { recursive: true, force: true })
  vi.clearAllMocks()
})

function mxsDir() {
  return path.join(tmpDir, 'mxs')
}

async function readCredentials(name: string): Promise<any> {
  return JSON.parse(
    await fs.readFile(
      path.join(mxsDir(), 'profiles', name, 'credentials.json'),
      'utf8',
    ),
  )
}

async function readConfig(name: string): Promise<any> {
  return JSON.parse(
    await fs.readFile(
      path.join(mxsDir(), 'profiles', name, 'config.json'),
      'utf8',
    ),
  )
}

async function readCurrent(): Promise<string | null> {
  try {
    return (await fs.readFile(path.join(mxsDir(), 'current'), 'utf8')).trim()
  } catch {
    return null
  }
}

const out: OutputOptions = { json: false, output: 'readable', quiet: true, verbose: false }

const { run } = await import('../../../src/commands/auth/login')

describe('auth login', () => {
  it('writes credentials to default profile on fresh install', async () => {
    await run({}, out)

    const creds = await readCredentials('default')
    expect(creds.access_token).toBe('new-access-token')
    expect(await readCurrent()).toBe('default')
  })

  it('writes to --profile dev and sets it as current', async () => {
    await run({ profile: 'dev' }, out)

    const creds = await readCredentials('dev')
    expect(creds.access_token).toBe('new-access-token')
    expect(await readCurrent()).toBe('dev')
  })

  it('refreshes active profile when no --profile flag', async () => {
    // Pre-create a profile dir and set it as current
    const profDir = path.join(mxsDir(), 'profiles', 'staging')
    await fs.mkdir(profDir, { recursive: true })
    await fs.mkdir(mxsDir(), { recursive: true })
    await fs.writeFile(path.join(mxsDir(), 'current'), 'staging\n')

    await run({}, out)

    const creds = await readCredentials('staging')
    expect(creds.access_token).toBe('new-access-token')
    expect(await readCurrent()).toBe('staging')
  })

  it('sets production flag when --production option is passed', async () => {
    await run({ profile: 'prod' }, out, { production: true })

    const cfg = await readConfig('prod')
    expect(cfg.production).toBe(true)
  })

  it('does not set production flag when option not passed', async () => {
    await run({ profile: 'dev' }, out)

    const cfg = await readConfig('dev')
    expect(cfg.production).toBeUndefined()
  })

  it('writes to local-dev when dev-default mode resolves that profile', async () => {
    // Pre-create a non-local-dev current pointer to verify dev mode overrides it.
    const profDir = path.join(mxsDir(), 'profiles', 'prod')
    await fs.mkdir(profDir, { recursive: true })
    await fs.mkdir(mxsDir(), { recursive: true })
    await fs.writeFile(path.join(mxsDir(), 'current'), 'prod\n')

    // resolveContext is mocked to surface profileName='local-dev' (as the real
    // resolveConfig does under MXS_CLI_DEV_DEFAULT_PROFILE=1).
    mocks.resolveContext.mockResolvedValueOnce({
      apiUrl: 'http://localhost:2333',
      apiBase: 'http://localhost:2333',
      authBase: 'http://localhost:2333/auth',
      apiVersion: 2,
      clientId: 'mxs-cli',
      token: undefined,
      configPath: '/tmp/c',
      credentialsPath: '/tmp/k',
      profileName: 'local-dev',
      isProduction: false,
      profileExplicit: false,
      urlOverridden: false,
    })

    await run({}, out)

    const creds = await readCredentials('local-dev')
    expect(creds.access_token).toBe('new-access-token')
    expect(await readCurrent()).toBe('local-dev')
  })
})

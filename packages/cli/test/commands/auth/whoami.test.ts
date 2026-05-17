import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OutputOptions } from '../../../src/core/output'

const mocks = vi.hoisted(() => ({
  buildApiClient: vi.fn(),
  request: vi.fn(),
  resolveContext: vi.fn(),
}))

vi.mock('../../../src/commands/internal/shared', () => ({
  buildApiClient: mocks.buildApiClient,
  resolveContext: mocks.resolveContext,
}))

const { run } = await import('../../../src/commands/auth/whoami')

const out: OutputOptions = {
  json: true,
  output: 'json',
  quiet: true,
  verbose: false,
}

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-whoami-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir

  mocks.resolveContext.mockResolvedValue({
    apiUrl: 'https://blog.example.com',
    apiBase: 'https://blog.example.com/api/v2',
    authBase: 'https://blog.example.com/api/v2/auth',
    apiVersion: 2,
    clientId: 'mxs-cli',
    token: 'access-token',
    configPath: '/tmp/config.json',
    credentialsPath: '/tmp/credentials.json',
  })
  mocks.buildApiClient.mockReturnValue({ request: mocks.request })
  mocks.request.mockReset()
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

async function makeProfile(name: string, creds: object) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'credentials.json'), JSON.stringify(creds), {
    mode: 0o600,
  })
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

describe('auth whoami', () => {
  let writes: string[]
  let writeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    writes = []
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(String(chunk))
        return true
      })
  })

  afterEach(() => {
    writeSpy.mockRestore()
  })

  it('uses live server session user when available', async () => {
    await makeProfile('default', {
      access_token: 'access-token',
      expires_at: Date.now() + 3600_000,
      user: null,
    })
    await setCurrent('default')

    mocks.request.mockResolvedValue({
      data: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
    })

    await run({}, out)

    expect(mocks.request).toHaveBeenCalledWith('/auth/session')
    expect(JSON.parse(writes.join(''))).toEqual({
      ok: true,
      data: {
        user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
        api_url: 'https://blog.example.com',
      },
    })
  })

  it('falls back to stored per-profile user when live session is null', async () => {
    await makeProfile('default', {
      access_token: 'access-token',
      expires_at: Date.now() + 3600_000,
      user: { id: 'cached-user', email: 'cached@example.com' },
    })
    await setCurrent('default')

    mocks.request.mockResolvedValue({ data: null })

    await run({}, out)

    expect(JSON.parse(writes.join('')).data.user).toEqual({
      id: 'cached-user',
      email: 'cached@example.com',
    })
  })

  it('falls back to per-profile credentials when server is unreachable', async () => {
    await makeProfile('dev', {
      access_token: 'access-token',
      expires_at: Date.now() + 3600_000,
      user: { id: 'offline-user', email: 'offline@example.com' },
    })
    await setCurrent('dev')

    mocks.request.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(run({}, out)).rejects.toThrow('ECONNREFUSED')
  })

  it('requires an authentication source when no profile credentials and no token', async () => {
    mocks.resolveContext.mockResolvedValue({
      apiUrl: 'https://blog.example.com',
      apiBase: 'https://blog.example.com/api/v2',
      authBase: 'https://blog.example.com/api/v2/auth',
      apiVersion: 2,
      clientId: 'mxs-cli',
      configPath: '/tmp/config.json',
      credentialsPath: '/tmp/credentials.json',
    })

    await expect(run({}, out)).rejects.toMatchObject({ code: 'auth.missing' })
  })

  it('reads per-profile credentials from active profile', async () => {
    await makeProfile('prod', {
      access_token: 'prod-token',
      expires_at: Date.now() + 3600_000,
      user: { id: 'prod-user', email: 'prod@example.com' },
    })
    await setCurrent('prod')

    mocks.request.mockResolvedValue({ data: null })

    await run({}, out)

    expect(JSON.parse(writes.join('')).data.user).toEqual({
      id: 'prod-user',
      email: 'prod@example.com',
    })
  })
})

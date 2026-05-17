import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OutputOptions } from '../../../src/core/output'

const mocks = vi.hoisted(() => ({
  buildApiClient: vi.fn(),
  readCredentials: vi.fn(),
  request: vi.fn(),
  resolveContext: vi.fn(),
}))

vi.mock('../../../src/core/config-store', () => ({
  readCredentials: mocks.readCredentials,
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
    mocks.readCredentials.mockResolvedValue({
      access_token: 'access-token',
      expires_at: Date.now() + 3600_000,
      user: null,
    })
    mocks.request.mockReset()
  })

  afterEach(() => {
    writeSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('uses live server session user when available', async () => {
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

  it('falls back to stored user when live session is null', async () => {
    mocks.readCredentials.mockResolvedValue({
      access_token: 'access-token',
      expires_at: Date.now() + 3600_000,
      user: { id: 'cached-user', email: 'cached@example.com' },
    })
    mocks.request.mockResolvedValue({ data: null })

    await run({}, out)

    expect(JSON.parse(writes.join('')).data.user).toEqual({
      id: 'cached-user',
      email: 'cached@example.com',
    })
  })

  it('requires an authentication source', async () => {
    mocks.resolveContext.mockResolvedValue({
      apiUrl: 'https://blog.example.com',
      apiBase: 'https://blog.example.com/api/v2',
      authBase: 'https://blog.example.com/api/v2/auth',
      apiVersion: 2,
      clientId: 'mxs-cli',
      configPath: '/tmp/config.json',
      credentialsPath: '/tmp/credentials.json',
    })
    mocks.readCredentials.mockResolvedValue(null)

    await expect(run({}, out)).rejects.toMatchObject({ code: 'auth.missing' })
  })
})

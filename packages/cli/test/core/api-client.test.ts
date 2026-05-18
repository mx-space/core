import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '../../src/core/api-client'
import type { ResolvedConfig } from '../../src/core/config-store'
import { MxsErrorCode } from '../../src/core/errors'

function makeResolved(
  overrides: Partial<
    Pick<
      ResolvedConfig,
      | 'isProduction'
      | 'profileExplicit'
      | 'urlOverridden'
      | 'profileName'
      | 'apiUrl'
    >
  > = {},
): ResolvedConfig {
  return {
    apiUrl: overrides.apiUrl ?? 'https://blog.example.com',
    apiBase: 'https://blog.example.com/api/v2',
    authBase: 'https://blog.example.com/api/v2/auth',
    apiVersion: 2,
    clientId: 'mxs-cli',
    configPath: '/tmp/config.json',
    credentialsPath: '/tmp/credentials.json',
    profileName: overrides.profileName ?? 'prod',
    isProduction: overrides.isProduction ?? false,
    profileExplicit: overrides.profileExplicit ?? false,
    urlOverridden: overrides.urlOverridden ?? false,
  }
}

function makeOkFetcher() {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

describe('ApiClient auth headers', () => {
  it('sends x-api-key when apiKey is configured', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const client = new ApiClient({
      apiBase: 'https://blog.example.com/api/v2',
      authBase: 'https://blog.example.com/api/v2/auth',
      clientId: 'mxs-cli',
      apiKey: 'txo-secret',
      http: { fetch: fetcher as any },
    })

    await client.request('/posts')

    const calls = fetcher.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('txo-secret')
    expect(headers.authorization).toBeUndefined()
  })

  it('keeps bearer token support for session tokens', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const client = new ApiClient({
      apiBase: 'https://blog.example.com/api/v2',
      authBase: 'https://blog.example.com/api/v2/auth',
      clientId: 'mxs-cli',
      token: 'session-token',
      http: { fetch: fetcher as any },
    })

    await client.request('/posts')

    const calls = fetcher.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer session-token')
    expect(headers['x-api-key']).toBeUndefined()
  })
})

describe('ApiClient production write gate', () => {
  it('throws profile.write_requires_explicit before issuing the HTTP call', async () => {
    const fetcher = makeOkFetcher()
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: false,
      urlOverridden: false,
      profileName: 'prod',
      apiUrl: 'https://blog.example.com',
    })
    const client = new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      http: { fetch: fetcher as any },
      resolved,
      quiet: true,
    })

    await expect(
      client.request('/posts', { method: 'POST', body: { title: 'x' } }),
    ).rejects.toMatchObject({
      code: MxsErrorCode.ProfileWriteRequiresExplicit,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('allows POST when profileExplicit is true', async () => {
    const fetcher = makeOkFetcher()
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: true,
      urlOverridden: false,
      profileName: 'prod',
    })
    const client = new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      http: { fetch: fetcher as any },
      resolved,
      quiet: true,
    })

    await expect(
      client.request('/posts', { method: 'POST', body: {} }),
    ).resolves.toMatchObject({ ok: true })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('allows POST when urlOverridden is true', async () => {
    const fetcher = makeOkFetcher()
    const resolved = makeResolved({
      isProduction: false,
      urlOverridden: true,
    })
    const client = new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      http: { fetch: fetcher as any },
      resolved,
    })

    await expect(
      client.request('/posts', { method: 'DELETE' }),
    ).resolves.toMatchObject({ ok: true })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('error details include profile and api_url fields', async () => {
    const fetcher = makeOkFetcher()
    const resolved = makeResolved({
      isProduction: true,
      profileExplicit: false,
      urlOverridden: false,
      profileName: 'myprod',
      apiUrl: 'https://my.blog.example.com',
    })
    const client = new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      http: { fetch: fetcher as any },
      resolved,
      quiet: true,
    })

    let caught: any
    try {
      await client.request('/posts', { method: 'PATCH', body: {} })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect(caught.code).toBe('profile.write_requires_explicit')
    expect(caught.details).toMatchObject({
      profile: 'myprod',
      api_url: 'https://my.blog.example.com',
    })
  })
})

describe('ApiClient production banner', () => {
  it('emits banner to stderr on construction when production and not quiet', () => {
    const stderrLines: string[] = []
    const origWrite = process.stderr.write.bind(process.stderr)
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })

    const resolved = makeResolved({
      isProduction: true,
      profileName: 'prod',
      apiUrl: 'https://blog.example.com',
    })

    new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      resolved,
      quiet: false,
    })

    spy.mockRestore()
    void origWrite

    expect(stderrLines.join('')).toMatch(
      /^mxs: profile=prod \(production\) → https:\/\/blog\.example\.com$/m,
    )
  })

  it('does not emit banner when quiet is true', () => {
    const stderrLines: string[] = []
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })

    const resolved = makeResolved({
      isProduction: true,
      profileName: 'prod',
    })

    new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      resolved,
      quiet: true,
    })

    spy.mockRestore()

    const banner = stderrLines.find((l) => l.includes('(production)'))
    expect(banner).toBeUndefined()
  })

  it('does not emit banner for non-production profile', () => {
    const stderrLines: string[] = []
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })

    const resolved = makeResolved({
      isProduction: false,
      profileName: 'dev',
    })

    new ApiClient({
      apiBase: resolved.apiBase,
      authBase: resolved.authBase,
      clientId: resolved.clientId,
      resolved,
      quiet: false,
    })

    spy.mockRestore()

    const banner = stderrLines.find((l) => l.includes('(production)'))
    expect(banner).toBeUndefined()
  })
})

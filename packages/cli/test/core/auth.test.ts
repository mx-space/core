import { describe, expect, it, vi } from 'vitest'

import {
  isExpiringSoon,
  pollDeviceToken,
  probeAuthEndpoint,
  refreshAccessToken,
  requestDeviceCode,
  toCredentials,
} from '../../src/core/auth'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('isExpiringSoon', () => {
  it('returns true when expiry is within buffer', () => {
    expect(
      isExpiringSoon(
        { access_token: 'x', expires_at: Date.now() + 1000 },
        60_000,
      ),
    ).toBe(true)
  })
  it('returns false when expiry is far', () => {
    expect(
      isExpiringSoon(
        { access_token: 'x', expires_at: Date.now() + 10 * 60_000 },
        60_000,
      ),
    ).toBe(false)
  })
})

describe('toCredentials', () => {
  it('computes expires_at from expires_in', () => {
    const before = Date.now()
    const cred = toCredentials({
      access_token: 'abc',
      token_type: 'Bearer',
      expires_in: 3600,
    })
    expect(cred.access_token).toBe('abc')
    expect(cred.expires_at).toBeGreaterThanOrEqual(before + 3590_000)
  })
})

describe('probeAuthEndpoint', () => {
  it('prefers /api/v2/auth when ok', async () => {
    const fetcher = vi.fn((url: string) => {
      if (url.endsWith('/api/v2/auth/ok'))
        return Promise.resolve(jsonResponse(200, { ok: true }))
      return Promise.resolve(jsonResponse(404, {}))
    })
    const result = await probeAuthEndpoint('https://blog.example.com', {
      fetch: fetcher as any,
    })
    expect(result.apiVersion).toBe(2)
    expect(result.authBase).toBe('https://blog.example.com/api/v2/auth')
  })
  it('falls back to /auth in dev', async () => {
    const fetcher = vi.fn((url: string) => {
      if (url === 'https://blog.example.com/auth/ok')
        return Promise.resolve(jsonResponse(200, { ok: true }))
      return Promise.resolve(jsonResponse(404, {}))
    })
    const result = await probeAuthEndpoint('https://blog.example.com', {
      fetch: fetcher as any,
    })
    expect(result.authBase).toBe('https://blog.example.com/auth')
  })
  it('throws when no endpoint responds', async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse(404, {})))
    await expect(
      probeAuthEndpoint('https://blog.example.com', {
        fetch: fetcher as any,
      }),
    ).rejects.toMatchObject({ code: 'auth.probe' })
  })
})

describe('requestDeviceCode', () => {
  it('returns response on success', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          device_code: 'dev',
          user_code: 'UC',
          verification_uri: 'https://blog/device',
          verification_uri_complete: 'https://blog/device?user_code=UC',
          expires_in: 1800,
          interval: 5,
        }),
      ),
    )
    const res = await requestDeviceCode(
      'https://blog.example.com/api/v2/auth',
      'mxs-cli',
      'openid',
      { fetch: fetcher as any },
    )
    expect(res.user_code).toBe('UC')
  })
  it('throws on non-2xx', async () => {
    const fetcher = vi.fn(() => Promise.resolve(jsonResponse(400, { error: 'x' })))
    await expect(
      requestDeviceCode(
        'https://blog.example.com/api/v2/auth',
        'mxs-cli',
        'openid',
        { fetch: fetcher as any },
      ),
    ).rejects.toThrow(/device code/)
  })
})

describe('pollDeviceToken', () => {
  it('returns token after pending then success', async () => {
    let call = 0
    const fetcher = vi.fn(() => {
      call++
      if (call === 1)
        return Promise.resolve(
          jsonResponse(400, { error: 'authorization_pending' }),
        )
      return Promise.resolve(
        jsonResponse(200, {
          access_token: 't',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      )
    })
    const t = await pollDeviceToken(
      'https://blog.example.com/api/v2/auth',
      'mxs-cli',
      'dev',
      { intervalSec: 0, expiresInSec: 5, http: { fetch: fetcher as any } },
    )
    expect(t.access_token).toBe('t')
  })
  it('throws on access_denied', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(jsonResponse(400, { error: 'access_denied' })),
    )
    await expect(
      pollDeviceToken(
        'https://blog.example.com/api/v2/auth',
        'mxs-cli',
        'dev',
        { intervalSec: 0, expiresInSec: 5, http: { fetch: fetcher as any } },
      ),
    ).rejects.toMatchObject({ code: 'auth.denied' })
  })
})

describe('refreshAccessToken', () => {
  it('returns null when no refresh_token', async () => {
    const r = await refreshAccessToken(
      'https://blog.example.com/api/v2/auth',
      'mxs-cli',
      { access_token: 'x', expires_at: 0 },
    )
    expect(r).toBeNull()
  })
  it('returns refreshed credentials when server responds', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          access_token: 'new',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      ),
    )
    const r = await refreshAccessToken(
      'https://blog.example.com/api/v2/auth',
      'mxs-cli',
      { access_token: 'old', refresh_token: 'rt', expires_at: 0 },
      { fetch: fetcher as any },
    )
    expect(r?.access_token).toBe('new')
  })
})

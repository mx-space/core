import { describe, expect, it, vi } from 'vitest'

import {
  isExpiringSoon,
  pollDeviceToken,
  probeAuthEndpoint,
  refreshAccessToken,
  requestDeviceCode,
  toCredentials,
} from '../../src/core/auth'
import { MxsErrorCode } from '../../src/core/errors'

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
    ).rejects.toMatchObject({ code: MxsErrorCode.AuthProbe })
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
    ).rejects.toMatchObject({ code: MxsErrorCode.AuthDenied })
  })
})

describe('refreshAccessToken', () => {
  it('returns null when session refresh does not extend expiry', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          session: { expiresAt: new Date(1000).toISOString() },
          user: { id: 'u1' },
        }),
      ),
    )
    const r = await refreshAccessToken(
      'https://blog.example.com/api/v2/auth',
      'mxs-cli',
      { access_token: 'x', expires_at: 1000 },
      { fetch: fetcher as any },
    )
    expect(r).toBeNull()
    expect(fetcher).toHaveBeenCalledWith(
      'https://blog.example.com/api/v2/auth/get-session',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer x',
        }),
      }),
    )
  })
  it('refreshes bearer session credentials through get-session', async () => {
    const nextExpiry = Date.now() + 3600_000
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            session: { expiresAt: new Date(nextExpiry).toISOString() },
            user: { id: 'u1', email: 'owner@example.com' },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'set-auth-token': 'signed-session-token',
            },
          },
        ),
      ),
    )

    const r = await refreshAccessToken(
      'https://blog.example.com/api/v2/auth',
      'mxs-cli',
      { access_token: 'old-session-token', expires_at: 0 },
      { fetch: fetcher as any },
    )

    expect(r).toEqual({
      access_token: 'signed-session-token',
      refresh_token: undefined,
      expires_at: nextExpiry,
      user: { id: 'u1', email: 'owner@example.com' },
    })
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

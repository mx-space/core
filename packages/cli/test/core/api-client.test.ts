import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '../../src/core/api-client'

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

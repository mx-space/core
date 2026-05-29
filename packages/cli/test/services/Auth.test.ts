import {
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from '@effect/platform'
import { describe, expect, it as itVitest, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import { Generic } from '../../src/domain/errors'
import {
  Auth,
  isExpiringSoon,
  toCredentials,
} from '../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type CredentialsShape,
  type ResolvedConfig,
} from '../../src/services/Config'
import { testHttpLayer } from '../helper/test-http'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseResolved: ResolvedConfig = {
  apiUrl: 'https://blog.example.com',
  apiBase: 'https://blog.example.com/api/v2',
  authBase: 'https://blog.example.com/api/v2/auth',
  apiVersion: 2,
  clientId: 'mxs-cli',
  configPath: '/tmp/config.json',
  credentialsPath: '/tmp/credentials.json',
  profileName: 'prod',
  isProduction: false,
  profileExplicit: false,
  urlOverridden: false,
}

const makeMockConfigLayer = (
  resolved: ResolvedConfig,
  creds: CredentialsShape | null,
  writes: { last: CredentialsShape | null } = { last: null },
  deletes: { invokedFor: string | null } = { invokedFor: null },
  resolveOverride?: ConfigService['resolve'],
) => {
  const service: ConfigService = {
    getConfigDir: Effect.succeed('/tmp'),
    getProfilesDir: Effect.succeed('/tmp/profiles'),
    getProfileDir: (name) => Effect.succeed(`/tmp/profiles/${name}`),
    getProfileConfigPath: (name) =>
      Effect.succeed(`/tmp/profiles/${name}/config.json`),
    getProfileCredentialsPath: (name) =>
      Effect.succeed(`/tmp/profiles/${name}/credentials.json`),
    getCurrentPath: Effect.succeed('/tmp/current'),
    getLegacyConfigPath: Effect.succeed('/tmp/config.json'),
    getLegacyCredentialsPath: Effect.succeed('/tmp/credentials.json'),
    readProfileConfig: () => Effect.succeed({}),
    writeProfileConfig: () => Effect.void,
    updateProfileConfig: () => Effect.succeed({}),
    readProfileCredentials: () => Effect.succeed(creds),
    writeProfileCredentials: (_name, cred) =>
      Effect.sync(() => {
        writes.last = cred
      }),
    deleteProfileCredentials: (name) =>
      Effect.sync(() => {
        deletes.invokedFor = name
      }),
    readLegacyConfig: Effect.succeed({}),
    readLegacyConfigRaw: Effect.succeed(null),
    readLegacyCredentialsRaw: Effect.succeed(null),
    deleteLegacyConfig: Effect.void,
    deleteLegacyCredentials: Effect.void,
    readCurrent: Effect.succeed(resolved.profileName),
    writeCurrent: () => Effect.void,
    listProfileDirs: Effect.succeed([]),
    profileExists: () => Effect.succeed(true),
    removeProfileDir: () => Effect.void,
    resolve: resolveOverride ?? (() => Effect.succeed(resolved)),
  }
  return Layer.succeed(Config, service)
}

const failingHttpLayer = (cause: unknown) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.RequestError({
          request,
          reason: 'Transport',
          cause,
        }),
      ),
    ),
  )

const responseErrorHttpLayer = (status: number) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.ResponseError({
          request,
          response: HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify({ ok: false }), {
              status,
              headers: { 'content-type': 'application/json' },
            }),
          ),
          reason: 'StatusCode',
        }),
      ),
    ),
  )

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('Auth pure helpers', () => {
  itVitest('isExpiringSoon — true when within buffer', () => {
    expect(
      isExpiringSoon(
        { access_token: 'x', expires_at: Date.now() + 1_000 },
        60_000,
      ),
    ).toBe(true)
  })
  itVitest('isExpiringSoon — false when far in the future', () => {
    expect(
      isExpiringSoon(
        { access_token: 'x', expires_at: Date.now() + 10 * 60_000 },
        60_000,
      ),
    ).toBe(false)
  })
  itVitest('toCredentials — computes expires_at from expires_in', () => {
    const before = Date.now()
    const cred = toCredentials({
      access_token: 'abc',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh',
      user: { id: 'u1', email: 'owner@example.com' },
    })
    expect(cred.access_token).toBe('abc')
    expect(cred.refresh_token).toBe('refresh')
    expect(cred.user?.id).toBe('u1')
    expect(cred.expires_at).toBeGreaterThanOrEqual(before + 3590_000)
  })
})

// ---------------------------------------------------------------------------
// probe
// ---------------------------------------------------------------------------

describe('Auth.probe', () => {
  itVitest('prefers /api/v2/auth when ok', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/auth/ok': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.probe('https://blog.example.com')
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res.apiVersion).toBe(2)
    expect(res.authBase).toBe('https://blog.example.com/api/v2/auth')
  })

  itVitest('falls back to /auth in dev', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/auth/ok': { status: 404 },
      'GET https://blog.example.com/auth/ok': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.probe('https://blog.example.com')
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res.authBase).toBe('https://blog.example.com/auth')
  })

  itVitest('fails AuthProbe when no endpoint responds', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/auth/ok': { status: 404 },
      'GET https://blog.example.com/auth/ok': { status: 404 },
    })
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.probe('https://blog.example.com')
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('AuthProbe')
  })

  itVitest.each([
    [{ code: 'ENOTFOUND' }, 'NetworkDns'],
    [{ code: 'EAI_AGAIN' }, 'NetworkDns'],
    [{ code: 'ECONNREFUSED' }, 'NetworkRefused'],
    [{ code: 'ETIMEDOUT' }, 'NetworkTimeout'],
    [{ cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }, 'NetworkTimeout'],
  ] as const)('maps transport failure %j to %s', async (cause, tag) => {
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(failingHttpLayer(cause)),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.probe('https://blog.example.com')
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe(tag)
  })

  itVitest('ignores generic transport failures while trying fallback endpoints', async () => {
    let call = 0
    const http = Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request) => {
        call += 1
        if (call === 1) {
          return Effect.fail(
            new HttpClientError.RequestError({
              request,
              reason: 'Transport',
              cause: new Error('temporary'),
            }),
          )
        }
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ),
        )
      }),
    )
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.probe('https://blog.example.com')
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res.authBase).toBe('https://blog.example.com/api/v2/auth')
  })

  itVitest('uses ResponseError responses as probe responses', async () => {
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(responseErrorHttpLayer(200)),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.probe('https://blog.example.com')
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res.authBase).toBe('https://blog.example.com/api/v3/auth')
  })
})

// ---------------------------------------------------------------------------
// requestDeviceCode
// ---------------------------------------------------------------------------

describe('Auth.requestDeviceCode', () => {
  itVitest('returns response on success', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/auth/device/code': {
        status: 200,
        body: {
          device_code: 'dev',
          user_code: 'UC',
          verification_uri: 'https://blog/device',
          verification_uri_complete: 'https://blog/device?user_code=UC',
          expires_in: 1800,
          interval: 5,
        },
      },
    })
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.requestDeviceCode(
        'https://blog.example.com/api/v2/auth',
        'mxs-cli',
        'openid',
      )
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res.user_code).toBe('UC')
    expect(http.recorder.calls[0]?.body).toEqual({
      client_id: 'mxs-cli',
      scope: 'openid',
    })
  })

  itVitest('fails AuthDenied on non-2xx', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/auth/device/code': {
        status: 400,
        body: { error: 'x' },
      },
    })
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.requestDeviceCode(
        'https://blog.example.com/api/v2/auth',
        'mxs-cli',
      )
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('AuthDenied')
  })

  itVitest('collapses non-generic transport errors to AuthDenied', async () => {
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(failingHttpLayer({ code: 'ECONNREFUSED' })),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.requestDeviceCode(
        'https://blog.example.com/api/v2/auth',
        'mxs-cli',
      )
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('AuthDenied')
  })
})

// ---------------------------------------------------------------------------
// pollDeviceToken
// ---------------------------------------------------------------------------

describe('Auth.pollDeviceToken', () => {
  const makeLayer = () =>
    Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(testHttpLayer({}).layer),
    )

  const poll = (opts: {
    readonly intervalSec?: number
    readonly expiresInSec?: number
    readonly signal?: AbortSignal
    readonly onTick?: (state: 'pending' | 'slow_down') => void
  } = {}) =>
    Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.pollDeviceToken(
        'https://blog.example.com/api/v2/auth',
        'mxs-cli',
        'device-code',
        {
          intervalSec: opts.intervalSec ?? 1,
          expiresInSec: opts.expiresInSec ?? 60,
          signal: opts.signal,
          onTick: opts.onTick,
        },
      )
    })

  itVitest('returns a token after pending and slow_down responses', async () => {
    vi.useFakeTimers()
    const ticks: string[] = []
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'authorization_pending' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'slow_down' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'TOKEN',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
    try {
      const promise = Effect.runPromise(
        Effect.provide(
          poll({ onTick: (state) => ticks.push(state) }),
          makeLayer(),
        ),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(6_000)
      await vi.advanceTimersByTimeAsync(6_000)
      const res = await promise
      expect(res.access_token).toBe('TOKEN')
      expect(ticks).toEqual(['pending', 'slow_down'])
      const request = JSON.parse(
        String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body),
      )
      expect(request).toMatchObject({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: 'device-code',
        client_id: 'mxs-cli',
      })
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  itVitest('maps access_denied to AuthDenied', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'access_denied' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )
    try {
      const promise = Effect.runPromise(
        Effect.flip(Effect.provide(poll(), makeLayer())),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      const err = await promise
      expect(err._tag).toBe('AuthDenied')
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  itVitest('maps expired_token and elapsed deadline to AuthExpired', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'expired_token' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )
    try {
      const tokenPromise = Effect.runPromise(
        Effect.flip(Effect.provide(poll(), makeLayer())),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      const tokenErr = await tokenPromise
      expect(tokenErr._tag).toBe('AuthExpired')

      const timeoutErr = await Effect.runPromise(
        Effect.flip(
          Effect.provide(poll({ expiresInSec: 0 }), makeLayer()),
        ),
      )
      expect(timeoutErr._tag).toBe('AuthExpired')
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  itVitest('maps unknown device-token responses and abort signals', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'server_error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    )
    try {
      const unknownPromise = Effect.runPromise(
        Effect.flip(Effect.provide(poll(), makeLayer())),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      const unknownErr = await unknownPromise
      expect(unknownErr._tag).toBe('AuthDenied')

      const controller = new AbortController()
      controller.abort()
      const abortErr = await Effect.runPromise(
        Effect.flip(
          Effect.provide(poll({ signal: controller.signal }), makeLayer()),
        ),
      )
      expect(abortErr._tag).toBe('AuthDenied')
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  itVitest('wraps fetch failures as Generic', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'))
    try {
      const promise = Effect.runPromise(
        Effect.flip(Effect.provide(poll(), makeLayer())),
      )
      await vi.advanceTimersByTimeAsync(1_000)
      const err = await promise
      expect(err._tag).toBe('Generic')
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})

// ---------------------------------------------------------------------------
// ensureFresh
// ---------------------------------------------------------------------------

describe('Auth.ensureFresh', () => {
  itVitest('returns existing credentials when not near expiry', async () => {
    const cred: CredentialsShape = {
      access_token: 'TOK',
      expires_at: Date.now() + 10 * 60_000,
    }
    const http = testHttpLayer({})
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, cred)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.ensureFresh(baseResolved)
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res.access_token).toBe('TOK')
  })

  itVitest('fails AuthMissing when no credentials stored', async () => {
    const http = testHttpLayer({})
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.ensureFresh(baseResolved)
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('AuthMissing')
  })

  itVitest('fails AuthMissing when no profile is resolved', async () => {
    const http = testHttpLayer({})
    const layer = Auth.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, profileName: null }, null),
      ),
      Layer.provide(http.layer),
    )
    const err = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.gen(function* () {
            const auth = yield* Auth
            return yield* auth.ensureFresh({ ...baseResolved, profileName: null })
          }),
          layer,
        ),
      ),
    )
    expect(err._tag).toBe('AuthMissing')
  })

  itVitest('refreshes via refresh_token grant and writes back', async () => {
    const cred: CredentialsShape = {
      access_token: 'OLD',
      refresh_token: 'rt',
      expires_at: Date.now() + 1_000, // within buffer → triggers refresh
    }
    const writes = { last: null as CredentialsShape | null }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => {
        if (String(url).endsWith('/auth/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'NEW',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          )
        }
        return new Response('not found', { status: 404 })
      })
    try {
      const http = testHttpLayer({})
      const layer = Auth.Default.pipe(
        Layer.provide(makeMockConfigLayer(baseResolved, cred, writes)),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const auth = yield* Auth
        return yield* auth.ensureFresh(baseResolved)
      })
      const res = await Effect.runPromise(Effect.provide(program, layer))
      expect(res.access_token).toBe('NEW')
      expect(writes.last?.access_token).toBe('NEW')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  itVitest('keeps existing credentials when refresh returns null', async () => {
    const cred: CredentialsShape = {
      access_token: 'OLD',
      refresh_token: 'rt',
      expires_at: Date.now() + 1_000,
    }
    const writes = { last: null as CredentialsShape | null }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )
    try {
      const http = testHttpLayer({})
      const layer = Auth.Default.pipe(
        Layer.provide(makeMockConfigLayer(baseResolved, cred, writes)),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const auth = yield* Auth
        return yield* auth.ensureFresh(baseResolved)
      })
      const res = await Effect.runPromise(Effect.provide(program, layer))
      expect(res.access_token).toBe('OLD')
      expect(writes.last).toBeNull()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  itVitest('refreshes session-token credentials through get-session', async () => {
    const cred: CredentialsShape = {
      access_token: 'OLD',
      expires_at: Date.now() + 1_000,
      user: { id: 'old' },
    }
    const writes = { last: null as CredentialsShape | null }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          session: { expiresAt: Date.now() + 3600_000 },
          user: { id: 'new' },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-auth-token': 'NEW',
          },
        },
      ),
    )
    try {
      const http = testHttpLayer({})
      const layer = Auth.Default.pipe(
        Layer.provide(makeMockConfigLayer(baseResolved, cred, writes)),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const auth = yield* Auth
        return yield* auth.ensureFresh(baseResolved)
      })
      const res = await Effect.runPromise(Effect.provide(program, layer))
      expect(res.access_token).toBe('NEW')
      expect(res.user?.id).toBe('new')
      expect(writes.last?.access_token).toBe('NEW')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  itVitest('keeps session-token credentials when get-session cannot extend expiry', async () => {
    const cred: CredentialsShape = {
      access_token: 'OLD',
      expires_at: Date.now() + 1_000,
      user: { id: 'old' },
    }
    const writes = { last: null as CredentialsShape | null }
    const responses = [
      new Response(JSON.stringify({ session: { expiresAt: 'bad-date' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      new Response(JSON.stringify({ session: { expiresAt: Date.now() } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      new Response(JSON.stringify({}), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    ]
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => responses.shift()!)
    try {
      const http = testHttpLayer({})
      const layer = Auth.Default.pipe(
        Layer.provide(makeMockConfigLayer(baseResolved, cred, writes)),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const auth = yield* Auth
        return yield* auth.ensureFresh(baseResolved)
      })
      await expect(
        Effect.runPromise(Effect.provide(program, layer)),
      ).resolves.toMatchObject({ access_token: 'OLD' })
      await expect(
        Effect.runPromise(Effect.provide(program, layer)),
      ).resolves.toMatchObject({ access_token: 'OLD' })
      await expect(
        Effect.runPromise(Effect.provide(program, layer)),
      ).resolves.toMatchObject({ access_token: 'OLD' })
      expect(writes.last).toBeNull()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

// ---------------------------------------------------------------------------
// whoami / status / login
// ---------------------------------------------------------------------------

describe('Auth user-facing summaries', () => {
  itVitest('whoami returns the refreshed credential user', async () => {
    const cred: CredentialsShape = {
      access_token: 'TOK',
      expires_at: Date.now() + 3600_000,
      user: { id: 'u1', email: 'owner@example.com', name: 'Owner' },
    }
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, cred)),
      Layer.provide(testHttpLayer({}).layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.whoami
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res).toMatchObject({
      id: 'u1',
      email: 'owner@example.com',
      name: 'Owner',
    })
  })

  itVitest('status reports missing profile, missing credentials, and user summary', async () => {
    const http = testHttpLayer({})
    const noProfileLayer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer({ ...baseResolved, profileName: null }, null)),
      Layer.provide(http.layer),
    )
    const missingCredLayer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(http.layer),
    )
    const authedLayer = Auth.Default.pipe(
      Layer.provide(
        makeMockConfigLayer(baseResolved, {
          access_token: 'TOK',
          expires_at: 123,
          user: { id: 'u1' },
        }),
      ),
      Layer.provide(http.layer),
    )

    const readStatus = Effect.gen(function* () {
      const auth = yield* Auth
      return yield* auth.status
    })
    expect(
      await Effect.runPromise(Effect.provide(readStatus, noProfileLayer)),
    ).toMatchObject({ authenticated: false, profile: null })
    expect(
      await Effect.runPromise(Effect.provide(readStatus, missingCredLayer)),
    ).toMatchObject({ authenticated: false, profile: 'prod' })
    expect(
      await Effect.runPromise(Effect.provide(readStatus, authedLayer)),
    ).toMatchObject({
      authenticated: true,
      profile: 'prod',
      expiresAt: 123,
      user: { id: 'u1', expiresAt: 123 },
    })
  })

  itVitest('login placeholder fails with Generic', async () => {
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(testHttpLayer({}).layer),
    )
    const err = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.gen(function* () {
            const auth = yield* Auth
            return yield* auth.login({})
          }),
          layer,
        ),
      ),
    )
    expect(err._tag).toBe('Generic')
  })

  itVitest('whoami and status wrap config resolution failures as Generic', async () => {
    const layer = Auth.Default.pipe(
      Layer.provide(
        makeMockConfigLayer(
          baseResolved,
          null,
          undefined,
          undefined,
          () => Effect.fail(new Generic({ message: 'resolve failed' })),
        ),
      ),
      Layer.provide(testHttpLayer({}).layer),
    )
    const whoamiErr = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.gen(function* () {
            const auth = yield* Auth
            return yield* auth.whoami
          }),
          layer,
        ),
      ),
    )
    const statusErr = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.gen(function* () {
            const auth = yield* Auth
            return yield* auth.status
          }),
          layer,
        ),
      ),
    )
    expect(whoamiErr._tag).toBe('Generic')
    expect(statusErr._tag).toBe('Generic')
  })
})

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('Auth.logout', () => {
  itVitest('delegates to Config.deleteProfileCredentials', async () => {
    const deletes = { invokedFor: null as string | null }
    const http = testHttpLayer({})
    const layer = Auth.Default.pipe(
      Layer.provide(
        makeMockConfigLayer(baseResolved, null, undefined, deletes),
      ),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const auth = yield* Auth
      yield* auth.logout('prod')
    })
    await Effect.runPromise(Effect.provide(program, layer))
    expect(deletes.invokedFor).toBe('prod')
  })

  itVitest('resolves the active profile when logout target is null and no-ops when unresolved', async () => {
    const deletes = { invokedFor: null as string | null }
    const http = testHttpLayer({})
    const layer = Auth.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null, undefined, deletes)),
      Layer.provide(http.layer),
    )
    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const auth = yield* Auth
          yield* auth.logout(null)
        }),
        layer,
      ),
    )
    expect(deletes.invokedFor).toBe('prod')

    const noTargetLayer = Auth.Default.pipe(
      Layer.provide(
        makeMockConfigLayer(
          { ...baseResolved, profileName: null },
          null,
          undefined,
          deletes,
        ),
      ),
      Layer.provide(http.layer),
    )
    deletes.invokedFor = null
    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const auth = yield* Auth
          yield* auth.logout(null)
        }),
        noTargetLayer,
      ),
    )
    expect(deletes.invokedFor).toBeNull()
  })
})

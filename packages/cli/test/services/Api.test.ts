import { HttpClient, HttpClientError, HttpClientResponse } from '@effect/platform'
import { describe, it as itVitest, expect, vi } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'

import {
  Config,
  type ConfigService,
  type CredentialsShape,
  type ResolvedConfig,
} from '../../src/services/Config'
import { Auth, type AuthService } from '../../src/services/Auth'
import { Api } from '../../src/services/Api'
import { testHttpLayer } from '../helper/test-http'

// ---------------------------------------------------------------------------
// Test fixtures
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
    deleteProfileCredentials: () => Effect.void,
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
    resolve: () => Effect.succeed(resolved),
  }
  return Layer.succeed(Config, service)
}

const makeMockAuthLayer = (overrides: Partial<AuthService> = {}) => {
  const noop: AuthService = {
    probe: () => Effect.die('probe not used'),
    requestDeviceCode: () => Effect.die('requestDeviceCode not used'),
    pollDeviceToken: () => Effect.die('pollDeviceToken not used'),
    refresh: () => Effect.succeed(null),
    login: () => Effect.die('login not used'),
    logout: () => Effect.void,
    whoami: Effect.die('whoami not used'),
    status: Effect.die('status not used'),
    ensureFresh: (r) =>
      Effect.succeed({
        access_token: r.token ?? '',
        expires_at: Date.now() + 3600_000,
      }),
    enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
    ...overrides,
  }
  return Layer.succeed(Auth, noop)
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

const responseErrorHttpLayer = () =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.ResponseError({
          request,
          response: HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify({ message: 'bad' }), {
              status: 500,
              headers: { 'content-type': 'application/json' },
            }),
          ),
          reason: 'StatusCode',
        }),
      ),
    ),
  )

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Api.request', () => {
  itVitest('sends Authorization header when token resolved', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer({ ...baseResolved, token: 'tok' }, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/posts')
    })
    const result = await Effect.runPromise(Effect.provide(program, layer))
    expect(result).toEqual({ ok: true })
    expect(http.recorder.calls[0]?.headers.authorization).toBe('Bearer tok')
  })

  itVitest('sends x-api-key when apiKey resolved (no token)', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, apiKey: 'txo-secret' }, null),
      ),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/posts')
    })
    await Effect.runPromise(Effect.provide(program, layer))
    expect(http.recorder.calls[0]?.headers['x-api-key']).toBe('txo-secret')
    expect(http.recorder.calls[0]?.headers.authorization).toBeUndefined()
  })

  itVitest(
    'production write-gate refuses POST before issuing the HTTP call',
    async () => {
      const http = testHttpLayer({})
      const resolved: ResolvedConfig = {
        ...baseResolved,
        isProduction: true,
        profileExplicit: false,
        urlOverridden: false,
        profileName: 'prod',
      }
      const layer = Api.Default.pipe(
        Layer.provide(makeMockConfigLayer(resolved, null)),
        Layer.provide(makeMockAuthLayer()),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const api = yield* Api
        return yield* api.request('/posts', {
          method: 'POST',
          body: { title: 'x' },
        })
      }).pipe(Effect.flip)
      const err = await Effect.runPromise(Effect.provide(program, layer))
      expect(err._tag).toBe('WriteRequiresExplicit')
      expect((err as { details: { profile: string; api_url: string } }).details).toMatchObject({
        profile: 'prod',
        api_url: 'https://blog.example.com',
      })
      expect(http.recorder.calls.length).toBe(0)
    },
  )

  itVitest('allows POST when profileExplicit', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/posts': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Api.layer({ quiet: true }).pipe(
      Layer.provide(
        makeMockConfigLayer(
          { ...baseResolved, isProduction: true, profileExplicit: true },
          null,
        ),
      ),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/posts', { method: 'POST', body: {} })
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res).toEqual({ ok: true })
    expect(http.recorder.calls.length).toBe(1)
  })

  itVitest('401 once → refresh → retry once succeeds', async () => {
    const writes = { last: null as CredentialsShape | null }
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/me': ({ call, request }) => {
        if (call === 1) {
          return { status: 401, body: { message: 'expired' } }
        }
        // second call should carry the refreshed token
        const auth = request.headers.authorization
        if (auth !== 'Bearer NEW') {
          return { status: 500, body: { message: 'wrong header' } }
        }
        return { status: 200, body: { id: 'u1' } }
      },
    })
    const creds: CredentialsShape = {
      access_token: 'OLD',
      refresh_token: 'rt',
      expires_at: Date.now() + 3600_000,
    }
    const refreshed: CredentialsShape = {
      access_token: 'NEW',
      refresh_token: 'rt',
      expires_at: Date.now() + 7200_000,
    }
    const configLayer = makeMockConfigLayer(
      { ...baseResolved, token: 'OLD' },
      creds,
      writes,
    )
    const authLayer = makeMockAuthLayer({
      refresh: () => Effect.succeed(refreshed),
      ensureFresh: () => Effect.succeed(creds),
    })
    const layer = Api.Default.pipe(
      Layer.provide(configLayer),
      Layer.provide(authLayer),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/me')
    })
    const result = await Effect.runPromise(Effect.provide(program, layer))
    expect(result).toEqual({ id: 'u1' })
    expect(http.recorder.calls.length).toBe(2)
    expect(writes.last).toEqual(refreshed)
  })

  itVitest('non-2xx after refresh maps to AuthExpired', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/me': {
        status: 401,
        body: { message: 'token bad' },
      },
    })
    const creds: CredentialsShape = {
      access_token: 'OLD',
      expires_at: Date.now() + 3600_000,
    }
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, token: 'OLD' }, creds),
      ),
      Layer.provide(
        makeMockAuthLayer({
          refresh: () => Effect.succeed(null),
          ensureFresh: () => Effect.succeed(creds),
        }),
      ),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/me')
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('AuthExpired')
  })

  itVitest('schema decode failure maps to ServerError(status=200)', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts/1': {
        status: 200,
        body: { id: 'not-a-number' },
      },
    })
    const schema = Schema.Struct({ id: Schema.Number })
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/posts/1', { schema })
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('ServerError')
    expect((err as { status?: number }).status).toBe(200)
    expect((err as { message?: string }).message).toBe(
      'response shape mismatch',
    )
  })

  itVitest('404 maps to ResourceNotFound', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/missing': {
        status: 404,
        body: { message: 'not found' },
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/missing')
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('ResourceNotFound')
  })

  itVitest('production banner emitted ONCE to stderr', async () => {
    const stderrLines: string[] = []
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })
    try {
      const http = testHttpLayer({
        'GET https://blog.example.com/api/v2/posts': {
          status: 200,
          body: { ok: true },
        },
      })
      const layer = Api.layer({ quiet: false }).pipe(
        Layer.provide(
          makeMockConfigLayer(
            { ...baseResolved, isProduction: true, profileName: 'prod' },
            null,
          ),
        ),
        Layer.provide(makeMockAuthLayer()),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const api = yield* Api
        yield* api.request('/posts')
        yield* api.request('/posts')
      })
      await Effect.runPromise(Effect.provide(program, layer))
      const banners = stderrLines.filter((l) => l.includes('(production)'))
      expect(banners.length).toBe(1)
      expect(banners[0]).toMatch(
        /^mxs: profile=prod \(production\) → https:\/\/blog\.example\.com\n$/,
      )
    } finally {
      spy.mockRestore()
    }
  })

  itVitest('verbose mode logs METHOD URL → STATUS (Xms) to stderr', async () => {
    const stderrLines: string[] = []
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })
    try {
      const http = testHttpLayer({
        'GET https://blog.example.com/api/v2/posts': {
          status: 200,
          body: { ok: true },
        },
      })
      const layer = Api.layer({ verbose: true, quiet: true }).pipe(
        Layer.provide(makeMockConfigLayer(baseResolved, null)),
        Layer.provide(makeMockAuthLayer()),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const api = yield* Api
        return yield* api.request('/posts')
      })
      await Effect.runPromise(Effect.provide(program, layer))
      const verboseLine = stderrLines.find((l) =>
        l.startsWith('GET https://blog.example.com/api/v2/posts → 200'),
      )
      expect(verboseLine).toBeDefined()
      expect(verboseLine).toMatch(/\(\d+ms\)/)
    } finally {
      spy.mockRestore()
    }
  })

  itVitest('ensureFresh swaps to refreshed token on near-expiry', async () => {
    const creds: CredentialsShape = {
      access_token: 'STALE',
      refresh_token: 'rt',
      expires_at: Date.now() + 1_000, // within 60s buffer
    }
    const refreshed: CredentialsShape = {
      access_token: 'FRESH',
      refresh_token: 'rt',
      expires_at: Date.now() + 3600_000,
    }
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/me': ({ request }) => {
        if (request.headers.authorization !== 'Bearer FRESH') {
          return { status: 500, body: { message: 'token not refreshed' } }
        }
        return { status: 200, body: { id: 'u1' } }
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, token: 'STALE' }, creds),
      ),
      Layer.provide(
        makeMockAuthLayer({
          ensureFresh: () => Effect.succeed(refreshed),
        }),
      ),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/me')
    })
    const res = await Effect.runPromise(Effect.provide(program, layer))
    expect(res).toEqual({ id: 'u1' })
  })

  itVitest('injects lang into GET query while preserving caller query', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts?lang=ja-JP&page=2': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Api.layer({ lang: 'zh-CN' }).pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/posts', {
        query: { page: 2, lang: 'ja-JP', ignored: undefined },
      })
    })
    await Effect.runPromise(Effect.provide(program, layer))
    expect(http.recorder.calls[0]?.url).toBe(
      'https://blog.example.com/api/v2/posts?lang=ja-JP&page=2',
    )
  })

  itVitest('dry-run short-circuits writes before HTTP', async () => {
    const stderrLines: string[] = []
    const spy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: any) => {
        stderrLines.push(String(chunk))
        return true
      })
    try {
      const http = testHttpLayer({})
      const layer = Api.layer({ dryRun: true, verbose: true }).pipe(
        Layer.provide(
          makeMockConfigLayer({ ...baseResolved, profileExplicit: true }, null),
        ),
        Layer.provide(makeMockAuthLayer()),
        Layer.provide(http.layer),
      )
      const program = Effect.gen(function* () {
        const api = yield* Api
        return yield* api.request('/posts', {
          method: 'POST',
          query: { draft: true },
          body: { title: 'x' },
        })
      })
      const result = await Effect.runPromise(Effect.provide(program, layer))
      expect(result).toMatchObject({
        ok: true,
        data: { dryRun: true, method: 'POST', path: '/posts' },
      })
      expect(http.recorder.calls).toHaveLength(0)
      expect(stderrLines.join('')).toContain('would send POST')
    } finally {
      spy.mockRestore()
    }
  })

  itVitest('supports raw(), relative paths without leading slash, custom headers, and FormData bodies', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/upload': ({ request }) => {
        if (request.headers['x-custom'] !== 'yes') {
          return { status: 400, body: { message: 'missing custom header' } }
        }
        if (request.headers['content-type']) {
          return { status: 400, body: { message: 'unexpected content-type' } }
        }
        return { status: 200, body: { uploaded: true } }
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, profileExplicit: true }, null),
      ),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const form = new FormData()
    form.set('file', new Blob(['body']), 'body.txt')
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.raw('upload', {
        method: 'POST',
        headers: { 'x-custom': 'yes' },
        body: form,
      })
    })
    await expect(
      Effect.runPromise(Effect.provide(program, layer)),
    ).resolves.toEqual({ uploaded: true })
  })

  itVitest('maps JSON body encoding failures to Generic before HTTP execution', async () => {
    const http = testHttpLayer({})
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, profileExplicit: true }, null),
      ),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* Effect.flip(
        api.request('/posts', { method: 'POST', body: circular }),
      )
    })
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('Generic')
    expect(http.recorder.calls).toHaveLength(0)
  })

  itVitest('returns undefined when a JSON response body cannot be parsed', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/bad-json': {
        status: 200,
        body: '{',
        headers: { 'content-type': 'application/json' },
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/bad-json')
    })
    const result = await Effect.runPromise(Effect.provide(program, layer))
    expect(result).toBeUndefined()
  })

  itVitest('maps 403, 400, 422, 500, and other statuses to tagged errors', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/forbidden': {
        status: 403,
        body: { message: 'no' },
      },
      'GET https://blog.example.com/api/v2/bad': {
        status: 400,
        body: { message: ['a', 'b'] },
      },
      'GET https://blog.example.com/api/v2/invalid': {
        status: 422,
        body: {},
      },
      'GET https://blog.example.com/api/v2/broken': {
        status: 503,
        body: { message: 'down' },
      },
      'GET https://blog.example.com/api/v2/teapot': {
        status: 418,
        body: 'short and stout',
        headers: { 'content-type': 'text/plain' },
      },
    })
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(http.layer),
    )
    const tagFor = (path: string) =>
      Effect.gen(function* () {
        const api = yield* Api
        const err = yield* Effect.flip(api.request(path))
        return err._tag
      }).pipe(Effect.provide(layer))

    await expect(Effect.runPromise(tagFor('/forbidden'))).resolves.toBe(
      'AuthDenied',
    )
    await expect(Effect.runPromise(tagFor('/bad'))).resolves.toBe(
      'ValidationFailed',
    )
    await expect(Effect.runPromise(tagFor('/invalid'))).resolves.toBe(
      'ValidationFailed',
    )
    await expect(Effect.runPromise(tagFor('/broken'))).resolves.toBe(
      'ServerError',
    )
    await expect(Effect.runPromise(tagFor('/teapot'))).resolves.toBe('Generic')
  })

  itVitest('does not retry 401 when stored credentials no longer match the request token', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/me': {
        status: 401,
        body: { message: 'expired' },
      },
    })
    const creds: CredentialsShape = {
      access_token: 'DIFFERENT',
      expires_at: Date.now() + 3600_000,
    }
    const refresh = vi.fn(() =>
      Effect.succeed({
        access_token: 'NEW',
        expires_at: Date.now() + 7200_000,
      }),
    )
    const layer = Api.Default.pipe(
      Layer.provide(
        makeMockConfigLayer({ ...baseResolved, token: 'OLD' }, creds),
      ),
      Layer.provide(
        makeMockAuthLayer({
          refresh,
          ensureFresh: () => Effect.succeed({ ...creds, access_token: 'OLD' }),
        }),
      ),
      Layer.provide(http.layer),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* api.request('/me')
    }).pipe(Effect.flip)
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('AuthExpired')
    expect(refresh).not.toHaveBeenCalled()
    expect(http.recorder.calls).toHaveLength(1)
  })

  const transportCases: Array<{
    readonly name: string
    readonly cause: unknown
    readonly tag: string
  }> = [
    { name: 'dns not found', cause: { code: 'ENOTFOUND' }, tag: 'NetworkDns' },
    { name: 'dns retry', cause: { code: 'EAI_AGAIN' }, tag: 'NetworkDns' },
    {
      name: 'connection refused',
      cause: { code: 'ECONNREFUSED' },
      tag: 'NetworkRefused',
    },
    { name: 'timeout', cause: { code: 'ETIMEDOUT' }, tag: 'NetworkTimeout' },
    {
      name: 'nested timeout',
      cause: { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } },
      tag: 'NetworkTimeout',
    },
    { name: 'abort by name', cause: { name: 'AbortError' }, tag: 'Generic' },
    { name: 'abort by code', cause: { code: 'ABORT_ERR' }, tag: 'Generic' },
    { name: 'generic error', cause: new Error('socket closed'), tag: 'Generic' },
  ]

  for (const tc of transportCases) {
    itVitest(`maps transport failure: ${tc.name}`, async () => {
      const layer = Api.Default.pipe(
        Layer.provide(makeMockConfigLayer(baseResolved, null)),
        Layer.provide(makeMockAuthLayer()),
        Layer.provide(failingHttpLayer(tc.cause)),
      )
      const program = Effect.gen(function* () {
        const api = yield* Api
        return yield* Effect.flip(api.request('/posts'))
      })
      const err = await Effect.runPromise(Effect.provide(program, layer))
      expect(err._tag).toBe(tc.tag)
    })
  }

  itVitest('maps unexpected HttpClient ResponseError to Generic', async () => {
    const layer = Api.Default.pipe(
      Layer.provide(makeMockConfigLayer(baseResolved, null)),
      Layer.provide(makeMockAuthLayer()),
      Layer.provide(responseErrorHttpLayer()),
    )
    const program = Effect.gen(function* () {
      const api = yield* Api
      return yield* Effect.flip(api.request('/posts'))
    })
    const err = await Effect.runPromise(Effect.provide(program, layer))
    expect(err._tag).toBe('Generic')
    expect(err.message).toBe('unexpected response error')
  })
})

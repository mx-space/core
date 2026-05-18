import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import { edit } from '../../../src/cli/config/edit'
import { get } from '../../../src/cli/config/get'
import { list } from '../../../src/cli/config/list'
import { set } from '../../../src/cli/config/set'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type CredentialsShape,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Api } from '../../../src/services/Api'
import { Editor, type EditorService } from '../../../src/services/Editor'
import { Renderer } from '../../../src/services/Renderer'
import { testHttpLayer } from '../../helper/test-http'

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
  profileName: 'dev',
  isProduction: false,
  profileExplicit: false,
  urlOverridden: false,
}

const mockConfigLayer = (
  resolved: ResolvedConfig,
  creds: CredentialsShape | null = null,
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
    writeProfileCredentials: () => Effect.void,
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

const mockAuthLayer = () =>
  Layer.succeed(Auth, {
    probe: () => Effect.die('probe not used'),
    requestDeviceCode: () => Effect.die('requestDeviceCode not used'),
    pollDeviceToken: () => Effect.die('pollDeviceToken not used'),
    refresh: () => Effect.succeed(null),
    login: () => Effect.die('login not used'),
    logout: () => Effect.void,
    whoami: Effect.die('whoami not used'),
    status: Effect.die('status not used'),
    ensureFresh: () => Effect.die('ensureFresh not used'),
  } satisfies AuthService)

const mockEditorLayer = (overrides: Partial<EditorService> = {}) =>
  Layer.succeed(Editor, {
    openEditor: () => Effect.succeed(''),
    prompt: () => Effect.succeed(''),
    confirm: () => Effect.succeed(true),
    readFileOrStdin: () => Effect.succeed(''),
    ...overrides,
  } satisfies EditorService)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('config list command', () => {
  it('GETs /options and emits raw body', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/options': {
        status: 200,
        body: { site_url: 'https://example.com', enable_comments: true },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(mockConfigLayer(baseResolved)),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
    )
    const exit = await Effect.runPromiseExit(
      list.handler({}).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(1)
    expect(http.recorder.calls[0]?.method).toBe('GET')
  })
})

describe('config get command', () => {
  it('GETs /options/:key with url-encoded key', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/options/site%2Furl': {
        status: 200,
        body: 'https://example.com',
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(mockConfigLayer(baseResolved)),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
    )
    const exit = await Effect.runPromiseExit(
      get.handler({ key: 'site/url' }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})

describe('config set command', () => {
  it('coerces JSON by default and PATCHes /options/:key', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/options/feature': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(
          mockConfigLayer({
            ...baseResolved,
            profileExplicit: true,
          }),
        ),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
    )
    const exit = await Effect.runPromiseExit(
      set
        .handler({
          key: 'feature',
          value: '{"on":true}',
          type: Option.none(),
        })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls[0]?.body).toEqual({ on: true })
  })

  it('coerces explicit --type number and rejects NaN', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/options/count': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(
          mockConfigLayer({
            ...baseResolved,
            profileExplicit: true,
          }),
        ),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
    )

    const numOk = await Effect.runPromiseExit(
      set
        .handler({
          key: 'count',
          value: '42',
          type: Option.some('number' as const),
        })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(numOk)).toBe(true)
    expect(http.recorder.calls[0]?.body).toBe(42)

    const numBad = await Effect.runPromiseExit(
      set
        .handler({
          key: 'count',
          value: 'not-a-number',
          type: Option.some('number' as const),
        })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(numBad)).toBe(true)
    if (Exit.isFailure(numBad)) {
      const err = numBad.cause._tag === 'Fail' ? numBad.cause.error : null
      expect((err as { _tag: string })?._tag).toBe('ValidationFailed')
    }
  })

  it('coerces bool, string, explicit JSON failure, and implicit string fallback', async () => {
    const http = testHttpLayer({
      'PATCH https://blog.example.com/api/v2/options/flag': {
        status: 200,
        body: { ok: true },
      },
      'PATCH https://blog.example.com/api/v2/options/name': {
        status: 200,
        body: { ok: true },
      },
      'PATCH https://blog.example.com/api/v2/options/raw': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(
          mockConfigLayer({
            ...baseResolved,
            profileExplicit: true,
          }),
        ),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
    )

    await Effect.runPromise(
      set
        .handler({
          key: 'flag',
          value: 'true',
          type: Option.some('bool' as const),
        })
        .pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      set
        .handler({
          key: 'name',
          value: '{"literal":true}',
          type: Option.some('string' as const),
        })
        .pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      set
        .handler({
          key: 'raw',
          value: 'not-json',
          type: Option.none(),
        })
        .pipe(Effect.provide(layer)),
    )
    expect(http.recorder.calls.map((c) => c.body)).toEqual([
      true,
      '{"literal":true}',
      'not-json',
    ])

    const jsonBad = await Effect.runPromiseExit(
      set
        .handler({
          key: 'raw',
          value: 'not-json',
          type: Option.some('json' as const),
        })
        .pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(jsonBad)).toBe(true)
  })
})

describe('config edit command', () => {
  it('emits info when editor returns unchanged content', async () => {
    const initial = JSON.stringify({ site_url: 'https://example.com' }, null, 2)
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/options': {
        status: 200,
        body: { site_url: 'https://example.com' },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(mockConfigLayer(baseResolved)),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
      mockEditorLayer({
        openEditor: () => Effect.succeed(initial),
      }),
    )
    const exit = await Effect.runPromiseExit(
      edit.handler({}).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    // Only the initial GET — no PATCH because nothing changed.
    expect(http.recorder.calls.length).toBe(1)
  })

  it('patches every changed option after editor JSON changes', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/options': {
        status: 200,
        body: { site_url: 'https://example.com', enable_comments: true },
      },
      'PATCH https://blog.example.com/api/v2/options/site_url': {
        status: 200,
        body: { ok: true },
      },
      'PATCH https://blog.example.com/api/v2/options/enable_comments': {
        status: 200,
        body: { ok: true },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(
          mockConfigLayer({
            ...baseResolved,
            profileExplicit: true,
          }),
        ),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
      mockEditorLayer({
        openEditor: () =>
          Effect.succeed(
            JSON.stringify(
              { site_url: 'https://new.example.com', enable_comments: false },
              null,
              2,
            ),
          ),
      }),
    )
    const exit = await Effect.runPromiseExit(
      edit.handler({}).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.map((c) => c.method)).toEqual([
      'GET',
      'PATCH',
      'PATCH',
    ])
    expect(http.recorder.calls[1]?.body).toBe('https://new.example.com')
    expect(http.recorder.calls[2]?.body).toBe(false)
  })

  it('rejects invalid editor JSON', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/options': {
        status: 200,
        body: { site_url: 'https://example.com' },
      },
    })
    const layer = Layer.mergeAll(
      Api.layer({ quiet: true }).pipe(
        Layer.provide(mockConfigLayer(baseResolved)),
        Layer.provide(mockAuthLayer()),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
      mockEditorLayer({
        openEditor: () => Effect.succeed('{'),
      }),
    )
    const exit = await Effect.runPromiseExit(
      edit.handler({}).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(1)
  })
})

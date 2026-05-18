import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import { create } from '../../../src/cli/category/create'
import { del } from '../../../src/cli/category/delete'
import { get } from '../../../src/cli/category/get'
import { list } from '../../../src/cli/category/list'
import { update } from '../../../src/cli/category/update'
import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { Resolver } from '../../../src/services/Resolver'
import { testHttpLayer } from '../../helper/test-http'

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

const mockConfigLayer = (resolved: ResolvedConfig) => {
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
    readProfileCredentials: () => Effect.succeed(null),
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

const mockAuthLayer = Layer.succeed(Auth, {
  probe: () => Effect.die('probe not used'),
  requestDeviceCode: () => Effect.die('requestDeviceCode not used'),
  pollDeviceToken: () => Effect.die('pollDeviceToken not used'),
  refresh: () => Effect.succeed(null),
  login: () => Effect.die('login not used'),
  logout: () => Effect.void,
  whoami: Effect.die('whoami not used'),
  status: Effect.die('status not used'),
  ensureFresh: () => Effect.die('ensureFresh not used'),
  enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
} satisfies AuthService)

const buildLayer = (
  http: ReturnType<typeof testHttpLayer>,
  resolved: ResolvedConfig = baseResolved,
) => {
  const apiLayer = Api.layer({ quiet: true }).pipe(
    Layer.provide(mockConfigLayer(resolved)),
    Layer.provide(mockAuthLayer),
    Layer.provide(http.layer),
  )
  return Layer.mergeAll(
    apiLayer,
    Renderer.Default,
    Resolver.Default.pipe(Layer.provide(apiLayer)),
  )
}

describe('category list command', () => {
  it('GETs /categories and emits body', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/categories': {
        status: 200,
        body: { data: [{ id: '1', slug: 'tech', name: 'Tech' }] },
      },
    })
    const exit = await Effect.runPromiseExit(
      list.handler({}).pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(1)
  })
})

describe('category create command', () => {
  it('POSTs /categories with name+slug; type=tag maps to 1', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/categories': {
        status: 200,
        body: { ok: true },
      },
    })
    const exit = await Effect.runPromiseExit(
      create
        .handler({
          name: 'Tech',
          slug: 'tech',
          type: Option.some('tag' as const),
          icon: Option.some('rocket'),
        })
        .pipe(
          Effect.provide(
            buildLayer(http, { ...baseResolved, profileExplicit: true }),
          ),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls[0]?.body).toEqual({
      name: 'Tech',
      slug: 'tech',
      type: 1,
      icon: 'rocket',
    })
  })
})

describe('category update command', () => {
  it('PATCHes /categories/:id after resolving slug', async () => {
    const http = testHttpLayer({
      // resolver category lookup
      'GET https://blog.example.com/api/v2/categories/tech': {
        status: 200,
        body: { data: { id: 'cat-123', slug: 'tech', name: 'Tech' } },
      },
      'PATCH https://blog.example.com/api/v2/categories/cat-123': {
        status: 200,
        body: { ok: true },
      },
    })
    const exit = await Effect.runPromiseExit(
      update
        .handler({
          slugOrId: 'tech',
          name: Option.some('Technology'),
          slug: Option.none(),
          type: Option.none(),
          icon: Option.none(),
        })
        .pipe(
          Effect.provide(
            buildLayer(http, { ...baseResolved, profileExplicit: true }),
          ),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(2)
    expect(http.recorder.calls[1]?.method).toBe('PATCH')
    expect(http.recorder.calls[1]?.body).toEqual({ name: 'Technology' })
  })
})

describe('category delete command', () => {
  it('refuses without --force in non-TTY context', async () => {
    const http = testHttpLayer({})
    // Force non-TTY in test runner — process.stdin.isTTY is undefined under vitest.
    const exit = await Effect.runPromiseExit(
      del
        .handler({ slugOrId: '123456789012345', force: false })
        .pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(0)
  })

  it('deletes via DELETE /categories/:id with --force', async () => {
    const http = testHttpLayer({
      'DELETE https://blog.example.com/api/v2/categories/123456789012345': {
        status: 200,
        body: {},
      },
    })
    const exit = await Effect.runPromiseExit(
      del
        .handler({ slugOrId: '123456789012345', force: true })
        .pipe(
          Effect.provide(
            buildLayer(http, { ...baseResolved, profileExplicit: true }),
          ),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(1)
    expect(http.recorder.calls[0]?.method).toBe('DELETE')
  })
})

describe('category get command', () => {
  it('GETs /categories/:slugOrId', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/categories/tech': {
        status: 200,
        body: { data: { id: 'c1', slug: 'tech', name: 'Tech' } },
      },
    })
    const exit = await Effect.runPromiseExit(
      get.handler({ slugOrId: 'tech' }).pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})

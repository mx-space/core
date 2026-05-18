import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import { create } from '../../../src/cli/topic/create'
import { del } from '../../../src/cli/topic/delete'
import { get } from '../../../src/cli/topic/get'
import { list } from '../../../src/cli/topic/list'
import { update } from '../../../src/cli/topic/update'
import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
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
} satisfies AuthService)

const buildLayer = (
  http: ReturnType<typeof testHttpLayer>,
  resolved: ResolvedConfig = baseResolved,
) =>
  Layer.mergeAll(
    Api.layer({ quiet: true }).pipe(
      Layer.provide(mockConfigLayer(resolved)),
      Layer.provide(mockAuthLayer),
      Layer.provide(http.layer),
    ),
    Renderer.Default,
  )

describe('topic list command', () => {
  it('GETs /topics/all', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/topics/all': {
        status: 200,
        body: [{ id: 't1', slug: 'random' }],
      },
    })
    const exit = await Effect.runPromiseExit(
      list.handler({}).pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(1)
  })
})

describe('topic get command', () => {
  it('uses /topics/slug/:slug for non-snowflake refs', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/topics/slug/random': {
        status: 200,
        body: { id: 't1', slug: 'random' },
      },
    })
    const exit = await Effect.runPromiseExit(
      get
        .handler({ slugOrId: 'random' })
        .pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('uses /topics/:id for snowflake ids', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/topics/123456789012345': {
        status: 200,
        body: { id: '123456789012345' },
      },
    })
    const exit = await Effect.runPromiseExit(
      get
        .handler({ slugOrId: '123456789012345' })
        .pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})

describe('topic create command', () => {
  it('POSTs /topics with name+slug (+ optional description/icon)', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/topics': {
        status: 200,
        body: { ok: true },
      },
    })
    const exit = await Effect.runPromiseExit(
      create
        .handler({
          name: 'Random',
          slug: 'random',
          description: Option.some('Random thoughts'),
          icon: Option.none(),
        })
        .pipe(
          Effect.provide(
            buildLayer(http, { ...baseResolved, profileExplicit: true }),
          ),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls[0]?.body).toEqual({
      name: 'Random',
      slug: 'random',
      description: 'Random thoughts',
    })
  })
})

describe('topic update command', () => {
  it('resolves slug → id then PATCH /topics/:id', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/topics/slug/random': {
        status: 200,
        body: { id: 't1', slug: 'random' },
      },
      'PATCH https://blog.example.com/api/v2/topics/t1': {
        status: 200,
        body: { ok: true },
      },
    })
    const exit = await Effect.runPromiseExit(
      update
        .handler({
          slugOrId: 'random',
          name: Option.some('Renamed'),
          slug: Option.none(),
          description: Option.none(),
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
    expect(http.recorder.calls[1]?.body).toEqual({ name: 'Renamed' })
  })
})

describe('topic delete command', () => {
  it('refuses without --force in non-TTY context', async () => {
    const http = testHttpLayer({})
    const exit = await Effect.runPromiseExit(
      del
        .handler({ slugOrId: '123456789012345', force: false })
        .pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(0)
  })

  it('deletes via DELETE /topics/:id with --force on snowflake id', async () => {
    const http = testHttpLayer({
      'DELETE https://blog.example.com/api/v2/topics/123456789012345': {
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

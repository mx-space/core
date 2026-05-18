import { Effect, Exit, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import { create } from '../../../src/cli/page/create'
import { del } from '../../../src/cli/page/delete'
import { get } from '../../../src/cli/page/get'
import { list } from '../../../src/cli/page/list'
import { update } from '../../../src/cli/page/update'
import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Lexical } from '../../../src/services/Lexical'
import { Renderer } from '../../../src/services/Renderer'
import { makeMemFs, TestFsLive, TestPathLive } from '../../helper/test-fs'
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
  const fsLayer = TestFsLive(makeMemFs())
  const base = Layer.merge(fsLayer, TestPathLive)
  return Layer.mergeAll(
    Api.layer({ quiet: true }).pipe(
      Layer.provide(mockConfigLayer(resolved)),
      Layer.provide(mockAuthLayer),
      Layer.provide(http.layer),
    ),
    Renderer.Default,
    Lexical.Default,
    base,
  )
}

describe('page list command', () => {
  it('GETs /pages', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/pages': {
        status: 200,
        body: { data: [{ id: 'p1', slug: 'about' }] },
      },
    })
    const exit = await Effect.runPromiseExit(
      list.handler({}).pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(http.recorder.calls.length).toBe(1)
  })
})

describe('page get command', () => {
  it('uses /pages/slug/:slug for non-snowflake refs (with prefer=lexical)', async () => {
    const http = testHttpLayer({
      // The query is appended; testHttpLayer matches by exact url.
      'GET https://blog.example.com/api/v2/pages/slug/about?prefer=lexical': {
        status: 200,
        body: { id: 'p1', slug: 'about', title: 'About', contentFormat: 'markdown' },
      },
    })
    const exit = await Effect.runPromiseExit(
      get
        .handler({ slugOrId: 'about' })
        .pipe(Effect.provide(buildLayer(http))),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})

describe('page create command', () => {
  it('POSTs /pages with built payload (title/slug/format defaults to lexical)', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/pages': {
        status: 200,
        body: { id: 'p1', slug: 'about' },
      },
    })
    const exit = await Effect.runPromiseExit(
      create
        .handler({
          title: Option.some('About'),
          slug: Option.some('about'),
          subtitle: Option.none(),
          order: Option.none(),
          content: Option.none(),
          format: Option.none(),
          meta: Option.none(),
          file: Option.none(),
        })
        .pipe(
          Effect.provide(
            buildLayer(http, { ...baseResolved, profileExplicit: true }),
          ),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    const body = http.recorder.calls[0]?.body as Record<string, unknown>
    expect(body.title).toBe('About')
    expect(body.slug).toBe('about')
    expect(body.contentFormat).toBe('lexical')
  })
})

describe('page update command', () => {
  it('resolves slug → id then PATCH /pages/:id without content fields', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/pages/slug/about': {
        status: 200,
        body: { id: 'p-123', slug: 'about' },
      },
      'PATCH https://blog.example.com/api/v2/pages/p-123': {
        status: 200,
        body: { ok: true },
      },
    })
    const exit = await Effect.runPromiseExit(
      update
        .handler({
          slugOrId: 'about',
          title: Option.some('New title'),
          slug: Option.none(),
          subtitle: Option.none(),
          order: Option.none(),
          content: Option.none(),
          format: Option.none(),
          meta: Option.none(),
          file: Option.none(),
        })
        .pipe(
          Effect.provide(
            buildLayer(http, { ...baseResolved, profileExplicit: true }),
          ),
        ),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    const patchCall = http.recorder.calls.find((c) => c.method === 'PATCH')!
    expect(patchCall.body).toEqual({ title: 'New title' })
  })
})

describe('page delete command', () => {
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

  it('DELETEs /pages/:id with --force on snowflake id', async () => {
    const http = testHttpLayer({
      'DELETE https://blog.example.com/api/v2/pages/123456789012345': {
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
  })
})

import { describe, expect, it, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { Resolver } from '../../../src/services/Resolver'
import { publish } from '../../../src/cli/note/publish'
import { unpublish } from '../../../src/cli/note/unpublish'
import { testHttpLayer } from '../../helper/test-http'

const resolved: ResolvedConfig = {
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

const noopConfig: ConfigService = {
  getConfigDir: Effect.succeed('/tmp'),
  getProfilesDir: Effect.succeed('/tmp/profiles'),
  getProfileDir: () => Effect.succeed('/tmp/profiles/dev'),
  getProfileConfigPath: () => Effect.succeed('/tmp/dev/config.json'),
  getProfileCredentialsPath: () => Effect.succeed('/tmp/dev/cred.json'),
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

const noopAuth: AuthService = {
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
}

const makeLayer = (http: ReturnType<typeof testHttpLayer>) => {
  const apiLayer = Api.Default.pipe(
    Layer.provide(Layer.succeed(Config, noopConfig)),
    Layer.provide(Layer.succeed(Auth, noopAuth)),
    Layer.provide(http.layer),
  )
  return Layer.mergeAll(
    apiLayer,
    Renderer.Default,
    Resolver.Default.pipe(Layer.provide(apiLayer)),
  )
}

const SNOWFLAKE = '123456789012345'

describe('note publish / unpublish', () => {
  it('publish snowflake → PATCH /notes/<id>/publish with isPublished: true', async () => {
    const http = testHttpLayer({
      [`PATCH https://blog.example.com/api/v2/notes/${SNOWFLAKE}/publish`]: {
        status: 200,
        body: { id: SNOWFLAKE, isPublished: true },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = publish.handler({ slugOrId: SNOWFLAKE })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      expect(http.recorder.calls.length).toBe(1)
      expect(http.recorder.calls[0]?.body).toEqual({ isPublished: true })
    } finally {
      spy.mockRestore()
    }
  })

  it('unpublish nid → resolves via /notes/nid then PATCHes /notes/<id>/publish', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/notes/nid/42?single=1': {
        status: 200,
        body: { data: { id: 'note-1', nid: 42 } },
      },
      'PATCH https://blog.example.com/api/v2/notes/note-1/publish': {
        status: 200,
        body: { id: 'note-1', isPublished: false },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = unpublish.handler({ slugOrId: '42' })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const patch = http.recorder.calls.find((c) => c.method === 'PATCH')
      expect(patch?.url).toBe(
        'https://blog.example.com/api/v2/notes/note-1/publish',
      )
      expect(patch?.body).toEqual({ isPublished: false })
    } finally {
      spy.mockRestore()
    }
  })

  it('rejects non-snowflake non-nid input via ValidationFailed', async () => {
    const http = testHttpLayer({})
    const program = publish.handler({ slugOrId: 'hello-world' })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, makeLayer(http))),
    )
    expect(err._tag).toBe('ValidationFailed')
  })
})

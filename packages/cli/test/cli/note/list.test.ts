import { describe, expect, it, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'

import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { list } from '../../../src/cli/note/list'
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
}

describe('note list command', () => {
  it('issues GET /notes with paging query', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/notes?page=1&size=10&sortBy=created':
        {
          status: 200,
          body: { data: [{ id: 'n1' }] },
        },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const layer = Layer.mergeAll(
        Api.Default.pipe(
          Layer.provide(Layer.succeed(Config, noopConfig)),
          Layer.provide(Layer.succeed(Auth, noopAuth)),
          Layer.provide(http.layer),
        ),
        Renderer.Default,
      )
      const program = list.handler({
        page: Option.some(1),
        size: Option.some(10),
        state: Option.none(),
        sort: Option.some('created'),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls.length).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('omits all query params when none supplied', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/notes': {
        status: 200,
        body: { data: [] },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const layer = Layer.mergeAll(
        Api.Default.pipe(
          Layer.provide(Layer.succeed(Config, noopConfig)),
          Layer.provide(Layer.succeed(Auth, noopAuth)),
          Layer.provide(http.layer),
        ),
        Renderer.Default,
      )
      const program = list.handler({
        page: Option.none(),
        size: Option.none(),
        state: Option.none(),
        sort: Option.none(),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls[0]?.url).toBe(
        'https://blog.example.com/api/v2/notes',
      )
    } finally {
      spy.mockRestore()
    }
  })
})

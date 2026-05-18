import { HttpClient } from '@effect/platform'
import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'

import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { list } from '../../../src/cli/post/list'
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
  getProfileDir: (n) => Effect.succeed(`/tmp/profiles/${n}`),
  getProfileConfigPath: (n) => Effect.succeed(`/tmp/${n}/config.json`),
  getProfileCredentialsPath: (n) => Effect.succeed(`/tmp/${n}/cred.json`),
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

describe('post list command', () => {
  it('issues GET /posts with query', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts?page=2&size=5&sortBy=created':
        {
          status: 200,
          body: { data: [{ id: '1', title: 'hello' }] },
        },
    })
    const stdout: string[] = []
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((c: any) => (stdout.push(String(c)), true))
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
        page: Option.some(2),
        size: Option.some(5),
        state: Option.none(),
        sort: Option.some('created'),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls.length).toBe(1)
      const out = stdout.join('')
      expect(out).toContain('hello')
    } finally {
      spy.mockRestore()
    }
  })

  it('omits absent query params', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts': {
        status: 200,
        body: { data: [] },
      },
    })
    const layer = Layer.mergeAll(
      Api.Default.pipe(
        Layer.provide(Layer.succeed(Config, noopConfig)),
        Layer.provide(Layer.succeed(Auth, noopAuth)),
        Layer.provide(http.layer),
      ),
      Renderer.Default,
    )
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      const program = list.handler({
        page: Option.none(),
        size: Option.none(),
        state: Option.none(),
        sort: Option.none(),
      })
      await Effect.runPromise(Effect.provide(program, layer))
      expect(http.recorder.calls[0]?.url).toBe(
        'https://blog.example.com/api/v2/posts',
      )
    } finally {
      spy.mockRestore()
    }
  })

  it('propagates server errors as typed failures', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/posts': {
        status: 500,
        body: { message: 'boom' },
      },
    })
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
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, layer)),
    )
    expect(err._tag).toBe('ServerError')
  })
})

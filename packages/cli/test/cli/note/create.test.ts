import { NodeContext } from '@effect/platform-node'
import { describe, expect, it, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'

import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Lexical } from '../../../src/services/Lexical'
import { Renderer } from '../../../src/services/Renderer'
import { Resolver } from '../../../src/services/Resolver'
import { create } from '../../../src/cli/note/create'
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

const none = <A>(): Option.Option<A> => Option.none()
const some = <A>(v: A): Option.Option<A> => Option.some(v)

const baseEmpty = {
  title: none<string>(),
  slug: none<string>(),
  topic: none<string>(),
  content: none<string>(),
  format: none<'lexical' | 'markdown'>(),
  state: none<'publish' | 'draft'>(),
  mood: none<string>(),
  weather: none<string>(),
  publicAt: none<string>(),
  password: none<string>(),
  bookmark: none<string>(),
  coords: none<string>(),
  location: none<string>(),
  images: none<string>(),
  meta: none<string>(),
  file: none<string>(),
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
    Lexical.Default,
    NodeContext.layer,
  )
}

describe('note create command', () => {
  it('defaults title to 无题 when omitted', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/notes': {
        status: 200,
        body: { id: 'n1' },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = create.handler({
        ...baseEmpty,
        content: some('<p>hi</p>'),
        format: some('lexical'),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body.title).toBe('无题')
    } finally {
      spy.mockRestore()
    }
  })

  it('parses coords "lat,lng" into payload.coordinates', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/notes': {
        status: 200,
        body: { id: 'n1' },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = create.handler({
        ...baseEmpty,
        content: some('<p>hi</p>'),
        format: some('lexical'),
        coords: some('30.5,114.3'),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body.coordinates).toEqual({ latitude: 30.5, longitude: 114.3 })
    } finally {
      spy.mockRestore()
    }
  })

  it('rejects invalid coords with ValidationFailed', async () => {
    const http = testHttpLayer({})
    const program = create.handler({
      ...baseEmpty,
      content: some('<p>hi</p>'),
      format: some('lexical'),
      coords: some('abc,def'),
    })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, makeLayer(http))),
    )
    expect(err._tag).toBe('ValidationFailed')
    expect(http.recorder.calls.length).toBe(0)
  })
})

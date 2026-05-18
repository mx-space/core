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
import { create } from '../../../src/cli/post/create'
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
  category: none<string>(),
  content: none<string>(),
  format: none<'lexical' | 'markdown'>(),
  summary: none<string>(),
  state: none<'publish' | 'draft'>(),
  tags: none<string>(),
  copyright: none<string>(),
  pin: none<string>(),
  pinOrder: none<number>(),
  related: none<string>(),
  meta: none<string>(),
  file: none<string>(),
  open: false,
  silent: false,
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

describe('post create command', () => {
  it('builds payload from inline lexical content and POSTs /posts', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/posts': {
        status: 200,
        body: { id: '1', title: 't' },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = create.handler({
        ...baseEmpty,
        title: some('t'),
        slug: some('s'),
        content: some('<p>hello</p>'),
        format: some('lexical'),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      expect(http.recorder.calls.length).toBe(1)
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body.title).toBe('t')
      expect(body.slug).toBe('s')
      expect(body.contentFormat).toBe('lexical')
      expect(typeof body.content).toBe('string')
      // No category was specified so we never resolve.
      expect(body.categoryId).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('resolves category slug to categoryId via /categories', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/categories': {
        status: 200,
        body: {
          data: [{ id: 'cat-1', name: 'Tech', slug: 'tech' }],
        },
      },
      'POST https://blog.example.com/api/v2/posts': {
        status: 200,
        body: { id: '1' },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = create.handler({
        ...baseEmpty,
        title: some('t'),
        slug: some('s'),
        category: some('tech'),
        content: some('<p>hello</p>'),
        format: some('lexical'),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const postCall = http.recorder.calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/posts'),
      )
      const body = postCall?.body as Record<string, unknown>
      expect(body.categoryId).toBe('cat-1')
      expect(body.__categoryName).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('rejects empty lexical content with ValidationFailed', async () => {
    const http = testHttpLayer({})
    const program = create.handler({
      ...baseEmpty,
      title: some('t'),
      slug: some('s'),
      content: some(''),
      format: some('lexical'),
    })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, makeLayer(http))),
    )
    expect(err._tag).toBe('ValidationFailed')
    expect(http.recorder.calls.length).toBe(0)
  })
})

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
import { update } from '../../../src/cli/post/update'
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

const SNOWFLAKE = '123456789012345'

const draftEnvelope = `<mxpost>
  <meta>
    <title>t</title>
    <slug>s</slug>
    <state>draft</state>
  </meta>
  <content>
<p>hello</p>
  </content>
</mxpost>
`

describe('post update command', () => {
  it('ignores envelope <state> so a published post stays published', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mxs-update-'))
    const file = join(dir, 'article.xml')
    writeFileSync(file, draftEnvelope)

    const http = testHttpLayer({
      [`PATCH https://blog.example.com/api/v2/posts/${SNOWFLAKE}`]: {
        status: 200,
        body: { id: SNOWFLAKE },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = update.handler({
        ...baseEmpty,
        slugOrId: SNOWFLAKE,
        file: some(file),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body.title).toBe('t')
      expect('isPublished' in body).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('still honors an explicit --state flag', async () => {
    const http = testHttpLayer({
      [`PATCH https://blog.example.com/api/v2/posts/${SNOWFLAKE}`]: {
        status: 200,
        body: { id: SNOWFLAKE },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = update.handler({
        ...baseEmpty,
        slugOrId: SNOWFLAKE,
        title: some('t2'),
        state: some('draft' as const),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body.isPublished).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })
})

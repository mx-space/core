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
import { apply } from '../../../src/cli/post/apply'
import { stage } from '../../../src/cli/post/stage'
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

const envelope = `<mxpost>
  <meta>
    <title>t2</title>
    <slug>s2</slug>
    <state>draft</state>
  </meta>
  <content>
<p>staged body</p>
  </content>
</mxpost>
`

describe('post stage / apply', () => {
  it('stage → POST /drafts with refType/refId, post fields in typeSpecificData', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mxs-stage-'))
    const file = join(dir, 'article.xml')
    writeFileSync(file, envelope)

    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/drafts': {
        status: 200,
        body: { id: 'draft-1', version: 2 },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = stage.handler({
        ...baseEmpty,
        slugOrId: SNOWFLAKE,
        file: some(file),
      })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const body = http.recorder.calls[0]?.body as Record<string, unknown>
      expect(body.refType).toBe('post')
      expect(body.refId).toBe(SNOWFLAKE)
      expect(body.title).toBe('t2')
      expect(typeof body.content).toBe('string')
      const tsd = body.typeSpecificData as Record<string, unknown>
      expect(tsd.slug).toBe('s2')
      // publish state never travels through staging
      expect(tsd.isPublished).toBeUndefined()
      expect(body.isPublished).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('stage with nothing to send fails with ValidationFailed', async () => {
    const http = testHttpLayer({})
    const program = stage.handler({
      ...baseEmpty,
      slugOrId: SNOWFLAKE,
    })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, makeLayer(http))),
    )
    expect(err._tag).toBe('ValidationFailed')
    expect(http.recorder.calls.length).toBe(0)
  })

  it('apply → reads the staged draft and PATCHes the post with draftId', async () => {
    const http = testHttpLayer({
      [`GET https://blog.example.com/api/v2/drafts/by-ref/post/${SNOWFLAKE}`]:
        {
          status: 200,
          body: {
            data: {
              id: 'draft-1',
              title: 't2',
              text: 'staged body',
              content: '{"root":{}}',
              content_format: 'lexical',
              meta: { skill_ids: ['skill-1'] },
              type_specific_data: {
                slug: 's2',
                category_id: 'category-1',
                tags: ['tag-1'],
              },
              version: 2,
              published_version: 1,
            },
          },
        },
      [`PATCH https://blog.example.com/api/v2/posts/${SNOWFLAKE}`]: {
        status: 200,
        body: { id: SNOWFLAKE },
      },
    })
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    try {
      const program = apply.handler({ slugOrId: SNOWFLAKE })
      await Effect.runPromise(Effect.provide(program, makeLayer(http)))
      const patch = http.recorder.calls.find((c) => c.method === 'PATCH')
      const body = patch?.body as Record<string, unknown>
      expect(body.draftId).toBe('draft-1')
      expect(body.title).toBe('t2')
      expect(body.content).toBe('{"root":{}}')
      expect(body.contentFormat).toBe('lexical')
      expect(body.slug).toBe('s2')
      expect(body.category_id).toBe('category-1')
      expect(body.tags).toEqual(['tag-1'])
      expect(body.meta).toEqual({ skillIds: ['skill-1'] })
      // apply never touches publish state either
      expect(body.isPublished).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('apply with no staged draft fails with Generic', async () => {
    const http = testHttpLayer({
      [`GET https://blog.example.com/api/v2/drafts/by-ref/post/${SNOWFLAKE}`]:
        {
          status: 200,
          body: { data: null },
        },
    })
    const program = apply.handler({ slugOrId: SNOWFLAKE })
    const err = await Effect.runPromise(
      Effect.flip(Effect.provide(program, makeLayer(http))),
    )
    expect(err._tag).toBe('Generic')
    expect(
      http.recorder.calls.some((c) => c.method === 'PATCH'),
    ).toBe(false)
  })
})

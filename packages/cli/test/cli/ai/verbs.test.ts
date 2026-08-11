import { describe, expect, it, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'

import { AiTaskCreateFailed } from '../../../src/domain/errors'
import { byArticle as overviewByArticle } from '../../../src/cli/ai/overview/by-article'
import { list as overviewList } from '../../../src/cli/ai/overview/list'
import { list as summaryList } from '../../../src/cli/ai/summary/list'
import { regen } from '../../../src/cli/ai/summary/regen'
import { translate as summaryTranslate } from '../../../src/cli/ai/summary/translate'
import { refresh } from '../../../src/cli/ai/insights/refresh'
import { translate as insightsTranslate } from '../../../src/cli/ai/insights/translate'
import { run as ttsRun } from '../../../src/cli/ai/tts/run'
import { voices as ttsVoices } from '../../../src/cli/ai/tts/voices'
import { Ai } from '../../../src/services/Ai'
import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
import { Renderer } from '../../../src/services/Renderer'
import { Resolver } from '../../../src/services/Resolver'
import { testHttpLayer, type TestHttpLayerHandle } from '../../helper/test-http'

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
  enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
}

const buildLayer = (http: TestHttpLayerHandle) => {
  const apiLayer = Api.Default.pipe(
    Layer.provide(Layer.succeed(Config, noopConfig)),
    Layer.provide(Layer.succeed(Auth, noopAuth)),
    Layer.provide(http.layer),
  )
  return Layer.mergeAll(
    apiLayer,
    Ai.Default.pipe(Layer.provide(apiLayer)),
    Renderer.Default,
    Resolver.Default.pipe(Layer.provide(apiLayer)),
  )
}

const SNOWFLAKE = '123456789012345'
const created = {
  status: 200,
  body: { data: { taskId: '01H', created: true } },
}

const silenced = async (run: () => Promise<void>) => {
  const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    await run()
  } finally {
    out.mockRestore()
    err.mockRestore()
  }
}

describe('ai verb flag wiring', () => {
  it('summary regen --force posts force', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/ai/summaries/task': created,
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          regen.handler({
            id: SNOWFLAKE,
            to: ['en'],
            force: true,
            noWait: true,
          }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls.at(-1)?.body).toEqual({
      refId: SNOWFLAKE,
      targetLanguages: ['en'],
      force: true,
    })
  })

  it('insights refresh --to --force posts languages and force', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/ai/insights/task': created,
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          refresh.handler({
            id: SNOWFLAKE,
            to: ['en', 'ja'],
            force: true,
            noWait: true,
          }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls.at(-1)?.body).toEqual({
      refId: SNOWFLAKE,
      targetLanguages: ['en', 'ja'],
      force: true,
    })
  })

  it('summary translate posts targetLang without polling when --no-wait', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/ai/summaries/task/translate':
        created,
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          summaryTranslate.handler({
            id: SNOWFLAKE,
            to: 'ja',
            force: false,
            noWait: true,
          }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls.length).toBe(1)
    expect(http.recorder.calls[0]?.body).toEqual({
      refId: SNOWFLAKE,
      targetLang: 'ja',
    })
  })

  it('insights translate fails with the actionable source-missing message', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/ai/insights/task/translate': {
        status: 200,
        body: {
          data: { taskId: null, created: false, reason: 'source-missing' },
        },
      },
    })
    let err: unknown
    await silenced(async () => {
      err = await Effect.runPromise(
        Effect.provide(
          insightsTranslate.handler({
            id: SNOWFLAKE,
            to: 'ja',
            force: false,
            noWait: true,
          }),
          buildLayer(http),
        ).pipe(Effect.flip) as Effect.Effect<unknown, never, never>,
      )
    })
    expect(err).toBeInstanceOf(AiTaskCreateFailed)
    expect((err as AiTaskCreateFailed).message).toContain(
      'mxs ai insights refresh',
    )
  })

  it('summary list --grouped --search hits the grouped endpoint', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/ai/summaries/grouped?search=hello':
        { status: 200, body: { data: [] } },
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          summaryList.handler({
            page: Option.none(),
            size: Option.none(),
            grouped: true,
            search: Option.some('hello'),
          }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls[0]?.url).toBe(
      'https://blog.example.com/api/v2/ai/summaries/grouped?search=hello',
    )
  })

  it('overview list forwards search and type', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/ai/overview/grouped?search=x&type=post':
        { status: 200, body: { data: [] } },
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          overviewList.handler({
            page: Option.none(),
            size: Option.none(),
            search: Option.some('x'),
            type: Option.some('post' as const),
          }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls[0]?.url).toBe(
      'https://blog.example.com/api/v2/ai/overview/grouped?search=x&type=post',
    )
  })

  it('tts run posts langs and force', async () => {
    const http = testHttpLayer({
      'POST https://blog.example.com/api/v2/ai/tts/task': created,
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          ttsRun.handler({
            id: SNOWFLAKE,
            to: ['en', 'ja'],
            force: true,
            noWait: true,
          }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls.at(-1)?.body).toEqual({
      refId: SNOWFLAKE,
      langs: ['en', 'ja'],
      force: true,
    })
  })

  it('tts voices forwards provider and model', async () => {
    const http = testHttpLayer({
      'GET https://blog.example.com/api/v2/ai/tts/voices?providerId=p1&model=m1':
        { status: 200, body: { data: { voices: [] } } },
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          ttsVoices.handler({ provider: 'p1', model: 'm1' }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls[0]?.url).toBe(
      'https://blog.example.com/api/v2/ai/tts/voices?providerId=p1&model=m1',
    )
  })

  it('overview by-article hits the article endpoint', async () => {
    const http = testHttpLayer({
      [`GET https://blog.example.com/api/v2/ai/overview/article/${SNOWFLAKE}`]:
        { status: 200, body: { data: { article: { id: SNOWFLAKE } } } },
    })
    await silenced(async () => {
      await Effect.runPromise(
        Effect.provide(
          overviewByArticle.handler({ id: SNOWFLAKE }),
          buildLayer(http),
        ),
      )
    })
    expect(http.recorder.calls[0]?.url).toBe(
      `https://blog.example.com/api/v2/ai/overview/article/${SNOWFLAKE}`,
    )
  })
})

import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import {
  AiRecordNotFound,
  AiTaskCreateFailed,
  AiTaskFailed,
} from '../../../src/domain/errors'
import { Ai } from '../../../src/services/Ai'
import { Api } from '../../../src/services/Api'
import { Auth, type AuthService } from '../../../src/services/Auth'
import {
  Config,
  type ConfigService,
  type ResolvedConfig,
} from '../../../src/services/Config'
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
  enrichUser: (_profile, _authBase, cred) => Effect.succeed(cred),
}

const buildLayer = (httpLayer: Layer.Layer<any>) => {
  const apiLayer = Api.Default.pipe(
    Layer.provide(Layer.succeed(Config, noopConfig)),
    Layer.provide(Layer.succeed(Auth, noopAuth)),
    Layer.provide(httpLayer),
  )
  return Ai.Default.pipe(Layer.provide(apiLayer))
}

const URL_TASK_POST = 'https://blog.example.com/api/v2/ai/summaries/task'
const URL_TRANSLATE_POST = 'https://blog.example.com/api/v2/ai/translations/task'
const URL_INSIGHTS_POST = 'https://blog.example.com/api/v2/ai/insights/task'
const URL_SUMMARIES_GROUPED =
  'https://blog.example.com/api/v2/ai/summaries/grouped?page=1&size=50'
const URL_TRANSLATIONS_GROUPED =
  'https://blog.example.com/api/v2/ai/translations/grouped?page=1&size=50'
const URL_INSIGHTS_GROUPED =
  'https://blog.example.com/api/v2/ai/insights/grouped?page=1&size=50'
const taskUrl = (id: string) =>
  `https://blog.example.com/api/v2/tasks/${id}`

describe('Ai.regenSummary + waitForTask', () => {
  it('polls until completed and returns a final view', async () => {
    const TASK_ID = '01HXXX'
    const REF_ID = '012345678901234567'
    const { layer: http, recorder } = testHttpLayer({
      [`POST ${URL_TASK_POST}`]: {
        status: 200,
        body: { data: { taskId: TASK_ID, created: true } },
      },
      [`GET ${taskUrl(TASK_ID)}`]: ({ call }) =>
        call === 1
          ? { status: 200, body: { data: { status: 'running' } } }
          : {
              status: 200,
              body: {
                data: {
                  status: 'completed',
                  totalCost: 4.2,
                  totalTokens: 1234,
                  resultIds: ['r1'],
                  payload: { refId: REF_ID, targetLanguages: ['en'] },
                },
              },
            },
    })
    process.env.MXS_AI_POLL_MS = '1'
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      const created = yield* ai.regenSummary({
        refId: REF_ID,
        targetLanguages: ['en'],
      })
      return yield* ai.waitForTask(created.taskId, { type: created.type })
    })
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(buildLayer(http))),
    )
    delete process.env.MXS_AI_POLL_MS
    expect(result.status).toBe('completed')
    expect(result.totalTokens).toBe(1234)
    expect(result.totalCost).toBeCloseTo(4.2)
    expect(result.resultIds).toEqual(['r1'])
    const post = recorder.calls.find((c) => c.method === 'POST')
    expect(post?.body).toEqual({ refId: REF_ID, targetLanguages: ['en'] })
    const polls = recorder.calls.filter(
      (c) => c.method === 'GET' && c.url === taskUrl(TASK_ID),
    )
    expect(polls.length).toBeGreaterThanOrEqual(2)
  })

  it('throws AiTaskFailed on terminal failure', async () => {
    const TASK_ID = '01HFAIL'
    const { layer: http } = testHttpLayer({
      [`POST ${URL_TASK_POST}`]: {
        status: 200,
        body: { data: { taskId: TASK_ID, created: true } },
      },
      [`GET ${taskUrl(TASK_ID)}`]: {
        status: 200,
        body: {
          data: { status: 'failed', error: { message: 'provider down' } },
        },
      },
    })
    process.env.MXS_AI_POLL_MS = '1'
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      const created = yield* ai.regenSummary({ refId: 'a' })
      return yield* ai.waitForTask(created.taskId, { type: created.type })
    })
    const err = await Effect.runPromise(
      program.pipe(
        Effect.provide(buildLayer(http)),
        Effect.flip,
      ) as Effect.Effect<unknown, never, never>,
    )
    delete process.env.MXS_AI_POLL_MS
    expect(err).toBeInstanceOf(AiTaskFailed)
  })

  it('throws AiTaskFailed on partial_failed', async () => {
    const TASK_ID = '01HPARTIAL'
    const { layer: http } = testHttpLayer({
      [`POST ${URL_TASK_POST}`]: {
        status: 200,
        body: { data: { taskId: TASK_ID, created: true } },
      },
      [`GET ${taskUrl(TASK_ID)}`]: {
        status: 200,
        body: {
          data: {
            status: 'partial_failed',
            error: { message: 'ja failed' },
          },
        },
      },
    })
    process.env.MXS_AI_POLL_MS = '1'
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      const created = yield* ai.regenSummary({ refId: 'a' })
      return yield* ai.waitForTask(created.taskId, { type: created.type })
    })
    const err = await Effect.runPromise(
      program.pipe(
        Effect.provide(buildLayer(http)),
        Effect.flip,
      ) as Effect.Effect<unknown, never, never>,
    )
    delete process.env.MXS_AI_POLL_MS
    expect(err).toBeInstanceOf(AiTaskFailed)
  })

  it('flags missing taskId as AiTaskCreateFailed', async () => {
    const { layer: http } = testHttpLayer({
      [`POST ${URL_TASK_POST}`]: {
        status: 200,
        body: { data: { created: false } },
      },
    })
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      return yield* ai.regenSummary({ refId: 'a' })
    })
    const err = await Effect.runPromise(
      program.pipe(
        Effect.provide(buildLayer(http)),
        Effect.flip,
      ) as Effect.Effect<unknown, never, never>,
    )
    expect(err).toBeInstanceOf(AiTaskCreateFailed)
  })
})

describe('Ai.translate', () => {
  it('forwards targetLanguages verbatim', async () => {
    const { layer: http, recorder } = testHttpLayer({
      [`POST ${URL_TRANSLATE_POST}`]: {
        status: 200,
        body: { data: { taskId: '01HT', created: true } },
      },
    })
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      return yield* ai.translate({
        refId: 'abc',
        targetLanguages: ['en', 'ja'],
      })
    })
    const r = await Effect.runPromise(
      program.pipe(Effect.provide(buildLayer(http))),
    )
    expect(r.taskId).toBe('01HT')
    expect(recorder.calls.at(-1)?.body).toEqual({
      refId: 'abc',
      targetLanguages: ['en', 'ja'],
    })
  })
})

describe('Ai.refreshInsights', () => {
  it('sends only refId to the insights refresh endpoint', async () => {
    const { layer: http, recorder } = testHttpLayer({
      [`POST ${URL_INSIGHTS_POST}`]: {
        status: 200,
        body: { data: { taskId: '01HI', created: true } },
      },
    })
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      return yield* ai.refreshInsights({ refId: 'r' })
    })
    await Effect.runPromise(program.pipe(Effect.provide(buildLayer(http))))
    expect(recorder.calls.at(-1)?.body).toEqual({ refId: 'r' })
  })
})

describe('Ai grouped record lookup', () => {
  it('finds records under family-specific grouped response keys', async () => {
    const { layer: http } = testHttpLayer({
      [`GET ${URL_SUMMARIES_GROUPED}`]: {
        status: 200,
        body: {
          data: [
            {
              article: { id: 'post-1' },
              summaries: [{ id: 'summary-1', summary: 'one' }],
            },
          ],
          meta: { pagination: { totalPages: 1 } },
        },
      },
      [`GET ${URL_TRANSLATIONS_GROUPED}`]: {
        status: 200,
        body: {
          data: [
            {
              article: { id: 'post-1' },
              translations: [{ id: 'translation-1', title: 'one' }],
            },
          ],
          meta: { pagination: { totalPages: 1 } },
        },
      },
      [`GET ${URL_INSIGHTS_GROUPED}`]: {
        status: 200,
        body: {
          data: [
            {
              article: { id: 'post-1' },
              insights: [{ id: 'insights-1', content: 'one' }],
            },
          ],
          meta: { pagination: { totalPages: 1 } },
        },
      },
    })
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      const summary = yield* ai.getSummary('summary-1')
      const translation = yield* ai.getTranslation('translation-1')
      const insights = yield* ai.getInsights('insights-1')
      return { summary, translation, insights }
    })
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(buildLayer(http))),
    )
    expect(result.summary).toMatchObject({ id: 'summary-1' })
    expect(result.translation).toMatchObject({ id: 'translation-1' })
    expect(result.insights).toMatchObject({ id: 'insights-1' })
  })

  it('raises AiRecordNotFound after scanning grouped family keys', async () => {
    const { layer: http } = testHttpLayer({
      [`GET ${URL_SUMMARIES_GROUPED}`]: {
        status: 200,
        body: {
          data: [
            {
              article: { id: 'post-1' },
              summaries: [{ id: 'summary-1', summary: 'one' }],
            },
          ],
          meta: { pagination: { totalPages: 1 } },
        },
      },
    })
    const program = Effect.gen(function* () {
      const ai = yield* Ai
      return yield* ai.getSummary('missing')
    })
    const err = await Effect.runPromise(
      program.pipe(
        Effect.provide(buildLayer(http)),
        Effect.flip,
      ) as Effect.Effect<unknown, never, never>,
    )
    expect(err).toBeInstanceOf(AiRecordNotFound)
  })
})

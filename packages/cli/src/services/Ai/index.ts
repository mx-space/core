import { Context, Effect, Layer } from 'effect'

import type { Generic } from '../../domain/errors'
import { Api, type ApiService } from '../Api'
import { makeOverview } from './overview'
import { makeByArticle, makeList, makeMatchById } from './resources'
import { makeCreateTask, makeWaitForTask } from './tasks'
import type { AiService } from './types'

export type * from './types'

export const make = (api: ApiService): AiService => {
  const createTask = makeCreateTask(api)
  const list = makeList(api)
  const matchById = makeMatchById(api)
  const byArticle = makeByArticle(api)

  const translationsByArticle: AiService['getTranslationsByArticle'] = (
    refId,
    opts,
  ) =>
    opts?.lang
      ? api.request(`/ai/translations/article/${refId}`, {
          query: { lang: opts.lang },
        })
      : api.request(`/ai/translations/ref/${refId}`)

  return {
    // -- generate
    regenSummary: (input) =>
      createTask('summary', '/ai/summaries/task', {
        refId: input.refId,
        ...(input.targetLanguages?.length
          ? { targetLanguages: [...input.targetLanguages] }
          : {}),
        ...(input.force ? { force: true } : {}),
      }),

    translate: (input) =>
      createTask('translation', '/ai/translations/task', {
        refId: input.refId,
        targetLanguages: [...input.targetLanguages],
        ...(input.force ? { force: true } : {}),
      }),

    refreshInsights: (input) =>
      createTask('insights', '/ai/insights/task', {
        refId: input.refId,
        ...(input.targetLanguages?.length
          ? { targetLanguages: [...input.targetLanguages] }
          : {}),
        ...(input.force ? { force: true } : {}),
      }),

    translateSummary: (input) =>
      createTask(
        'summary_translation',
        '/ai/summaries/task/translate',
        {
          refId: input.refId,
          targetLang: input.targetLang,
          ...(input.force ? { force: true } : {}),
        },
        {
          sourceMissingHint:
            'no base summary to translate — run `mxs ai summary regen` first',
        },
      ),

    translateInsights: (input) =>
      createTask(
        'insights_translation',
        '/ai/insights/task/translate',
        {
          refId: input.refId,
          targetLang: input.targetLang,
          ...(input.force ? { force: true } : {}),
        },
        {
          sourceMissingHint:
            'no base insights to translate — run `mxs ai insights refresh` first',
        },
      ),

    runTts: (input) =>
      createTask('tts', '/ai/tts/task', {
        refId: input.refId,
        ...(input.targetLanguages?.length
          ? { langs: [...input.targetLanguages] }
          : {}),
        ...(input.force ? { force: true } : {}),
      }),

    waitForTask: makeWaitForTask(api),

    // -- tts
    listTts: list('/ai/tts', '/', '/grouped'),
    getTtsByArticle: (refId) => api.request(`/ai/tts/ref/${refId}`),
    discoverTtsVoices: (q) =>
      api.request('/ai/tts/voices', {
        query: { providerId: q.providerId, model: q.model },
      }),
    deleteTts: (id) =>
      api.request(`/ai/tts/${id}`, { method: 'DELETE' }).pipe(Effect.asVoid),

    // -- overview
    ...makeOverview(api),

    // -- summary
    listSummaries: list('/ai/summaries', '/', '/grouped'),
    getSummary: (id) => matchById('/ai/summaries', id, ['summaries']),
    getSummariesByArticle: byArticle('/ai/summaries'),
    updateSummary: (id, patch) =>
      api.request(`/ai/summaries/${id}`, { method: 'PATCH', body: patch }),
    deleteSummary: (id) =>
      api
        .request(`/ai/summaries/${id}`, { method: 'DELETE' })
        .pipe(Effect.asVoid),

    // -- translation
    listTranslations: list('/ai/translations', null, '/grouped'),
    getTranslation: (id) => matchById('/ai/translations', id, ['translations']),
    getTranslationsByArticle: translationsByArticle,
    getTranslationLanguages: (refId) =>
      api.request(`/ai/translations/article/${refId}/languages`),
    updateTranslation: (id, patch) =>
      api.request(`/ai/translations/${id}`, { method: 'PATCH', body: patch }),
    deleteTranslation: (id) =>
      api
        .request(`/ai/translations/${id}`, { method: 'DELETE' })
        .pipe(Effect.asVoid),

    // -- insights
    listInsights: list('/ai/insights', '/', '/grouped'),
    getInsights: (id) => matchById('/ai/insights', id, ['insights']),
    getInsightsByArticle: byArticle('/ai/insights'),
    updateInsights: (id, patch) =>
      api.request(`/ai/insights/${id}`, { method: 'PATCH', body: patch }),
    deleteInsights: (id) =>
      api
        .request(`/ai/insights/${id}`, { method: 'DELETE' })
        .pipe(Effect.asVoid),

    // -- entries
    listEntries: (q) =>
      api.request('/ai/translations/entries', {
        query: {
          page: q.page,
          size: q.size,
          keyPath: q.keyPath,
          lang: q.lang,
        },
      }),
    generateEntries: (input) =>
      api.request('/ai/translations/entries/generate', {
        method: 'POST',
        body: {
          ...(input.keyPaths?.length ? { keyPaths: [...input.keyPaths] } : {}),
          ...(input.targetLangs?.length
            ? { targetLangs: [...input.targetLangs] }
            : {}),
        },
      }),
    updateEntry: (id, patch) =>
      api.request(`/ai/translations/entries/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    deleteEntry: (id) =>
      api
        .request(`/ai/translations/entries/${id}`, { method: 'DELETE' })
        .pipe(Effect.asVoid),
  }
}

// Silence unused-import warning for the ambient `Generic` re-export (kept so
// callers can narrow `AiServiceError` without re-importing `errors.ts`).
export type _Generic = Generic

export class Ai extends Context.Tag('Ai')<Ai, AiService>() {
  static Default: Layer.Layer<Ai, never, Api> = Layer.effect(
    Ai,
    Effect.gen(function* () {
      const api = yield* Api
      return make(api)
    }),
  )
}

/** Build an Ai layer from an explicit ApiService (tests). */
export const layer = (api: ApiService): Layer.Layer<Ai> =>
  Layer.succeed(Ai, make(api))

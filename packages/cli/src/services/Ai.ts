import { Context, Effect, Layer } from 'effect'

import {
  AiRecordNotFound,
  AiTaskCreateFailed,
  AiTaskFailed,
  type Generic,
} from '../domain/errors'
import { Api, type ApiError, type ApiService } from './Api'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AiTaskType = 'summary' | 'translation' | 'insights'

export type AiTaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial_failed'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface AiTaskCreateResult {
  readonly taskId: string
  readonly created: boolean
  readonly type: AiTaskType
  readonly refId: string
  readonly targetLanguages?: ReadonlyArray<string>
}

export interface AiTaskFinalView {
  readonly type: AiTaskType
  readonly taskId: string
  readonly status: AiTaskStatus
  readonly refId?: string
  readonly targetLanguages?: ReadonlyArray<string>
  readonly totalTokens?: number
  readonly totalCost?: number
  readonly resultIds?: ReadonlyArray<string>
  readonly error?: { readonly message: string }
}

export interface AiTaskCreateInput {
  readonly refId: string
  readonly targetLanguages?: ReadonlyArray<string>
}

export interface AiTaskTranslateInput {
  readonly refId: string
  readonly targetLanguages: ReadonlyArray<string>
}

export interface AiWaitOptions {
  readonly type: AiTaskType
  readonly pollMs?: number
  /** Stderr progress emitter; receives a transition message per state change. */
  readonly onProgress?: (message: string) => void
}

export interface AiListQuery {
  readonly page?: number
  readonly size?: number
  readonly grouped?: boolean
}

export interface AiEntryListQuery {
  readonly page?: number
  readonly size?: number
  readonly keyPath?: string
  readonly lang?: string
}

export interface AiEntryGenerateInput {
  readonly keyPaths?: ReadonlyArray<string>
  readonly targetLangs?: ReadonlyArray<string>
}

export interface AiSummaryPatch {
  readonly summary: string
}

export interface AiInsightsPatch {
  readonly content: string
}

export interface AiTranslationPatch {
  title?: string
  text?: string
  subtitle?: string | null
  summary?: string
  tags?: ReadonlyArray<string>
  content?: string
}

export interface AiEntryPatch {
  readonly translatedText: string
}

export interface AiByArticleOptions {
  readonly lang?: string
  readonly onlyDb?: boolean
}

export type AiServiceError =
  | ApiError
  | AiTaskCreateFailed
  | AiTaskFailed
  | AiRecordNotFound

export interface AiService {
  // -- generate ------------------------------------------------------------
  readonly regenSummary: (
    input: AiTaskCreateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly translate: (
    input: AiTaskTranslateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly refreshInsights: (
    input: Pick<AiTaskCreateInput, 'refId'>,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly waitForTask: (
    taskId: string,
    options: AiWaitOptions,
  ) => Effect.Effect<AiTaskFinalView, AiTaskFailed | ApiError>

  // -- summary read/manage -------------------------------------------------
  readonly listSummaries: (q: AiListQuery) => Effect.Effect<unknown, ApiError>
  readonly getSummary: (
    id: string,
  ) => Effect.Effect<unknown, AiRecordNotFound | ApiError>
  readonly getSummariesByArticle: (
    refId: string,
    opts?: AiByArticleOptions,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateSummary: (
    id: string,
    patch: AiSummaryPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteSummary: (id: string) => Effect.Effect<void, ApiError>

  // -- translation read/manage --------------------------------------------
  readonly listTranslations: (
    q: AiListQuery,
  ) => Effect.Effect<unknown, ApiError>
  readonly getTranslation: (
    id: string,
  ) => Effect.Effect<unknown, AiRecordNotFound | ApiError>
  readonly getTranslationsByArticle: (
    refId: string,
    opts?: AiByArticleOptions,
  ) => Effect.Effect<unknown, ApiError>
  readonly getTranslationLanguages: (
    refId: string,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateTranslation: (
    id: string,
    patch: AiTranslationPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteTranslation: (id: string) => Effect.Effect<void, ApiError>

  // -- insights read/manage -----------------------------------------------
  readonly listInsights: (q: AiListQuery) => Effect.Effect<unknown, ApiError>
  readonly getInsights: (
    id: string,
  ) => Effect.Effect<unknown, AiRecordNotFound | ApiError>
  readonly getInsightsByArticle: (
    refId: string,
    opts?: AiByArticleOptions,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateInsights: (
    id: string,
    patch: AiInsightsPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteInsights: (id: string) => Effect.Effect<void, ApiError>

  // -- translation entries ------------------------------------------------
  readonly listEntries: (
    q: AiEntryListQuery,
  ) => Effect.Effect<unknown, ApiError>
  readonly generateEntries: (
    input: AiEntryGenerateInput,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateEntry: (
    id: string,
    patch: AiEntryPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteEntry: (id: string) => Effect.Effect<void, ApiError>
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const unwrapData = (raw: unknown): unknown => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const env = raw as { data?: unknown }
    if ('data' in env) return env.data
  }
  return raw
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

interface CreateTaskEnvelope {
  taskId?: string
  created?: boolean
}

const readCreateTask = (raw: unknown): CreateTaskEnvelope => {
  const inner = asRecord(unwrapData(raw))
  return {
    taskId: typeof inner.taskId === 'string' ? inner.taskId : undefined,
    created: typeof inner.created === 'boolean' ? inner.created : undefined,
  }
}

interface TaskRecord {
  status?: AiTaskStatus | string
  totalCost?: number | string
  totalTokens?: number | string
  resultIds?: ReadonlyArray<string>
  result?: { resultIds?: ReadonlyArray<string> }
  payload?: { refId?: string; targetLanguages?: ReadonlyArray<string> }
  error?: { message?: string } | string
  errorMessage?: string
}

const readTaskRecord = (raw: unknown): TaskRecord => {
  const inner = asRecord(unwrapData(raw))
  const result = asRecord(inner.result)
  const payload = asRecord(inner.payload)
  const errField = inner.error
  return {
    status:
      typeof inner.status === 'string'
        ? (inner.status as AiTaskStatus)
        : undefined,
    totalCost:
      typeof inner.totalCost === 'number' || typeof inner.totalCost === 'string'
        ? (inner.totalCost as number | string)
        : undefined,
    totalTokens:
      typeof inner.totalTokens === 'number' ||
      typeof inner.totalTokens === 'string'
        ? (inner.totalTokens as number | string)
        : undefined,
    resultIds: Array.isArray(inner.resultIds)
      ? (inner.resultIds as ReadonlyArray<string>)
      : Array.isArray(result.resultIds)
        ? (result.resultIds as ReadonlyArray<string>)
        : undefined,
    payload: {
      refId: typeof payload.refId === 'string' ? payload.refId : undefined,
      targetLanguages: Array.isArray(payload.targetLanguages)
        ? (payload.targetLanguages as ReadonlyArray<string>)
        : undefined,
    },
    error:
      typeof errField === 'string'
        ? { message: errField }
        : errField && typeof errField === 'object'
          ? (errField as { message?: string })
          : undefined,
    errorMessage:
      typeof inner.errorMessage === 'string' ? inner.errorMessage : undefined,
  }
}

const toNumber = (v: number | string | undefined): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

const TERMINAL: ReadonlySet<string> = new Set([
  'completed',
  'partial_failed',
  'succeeded',
  'failed',
  'cancelled',
])

const DEFAULT_POLL_MS = 1000

const resolvePollMs = (override?: number): number => {
  const envRaw = process.env.MXS_AI_POLL_MS
  if (override && override > 0) return override
  if (envRaw) {
    const n = Number(envRaw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_POLL_MS
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const make = (api: ApiService): AiService => {
  const createTask = (
    type: AiTaskType,
    path: string,
    body: Record<string, unknown>,
  ): Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError> =>
    Effect.gen(function* () {
      const raw = yield* api.request(path, { method: 'POST', body })
      const env = readCreateTask(raw)
      if (!env.taskId) {
        return yield* Effect.fail(
          new AiTaskCreateFailed({
            message: 'server returned no taskId',
            details: raw,
          }),
        )
      }
      return {
        taskId: env.taskId,
        created: env.created ?? true,
        type,
        refId: typeof body.refId === 'string' ? body.refId : '',
        targetLanguages: Array.isArray(body.targetLanguages)
          ? (body.targetLanguages as ReadonlyArray<string>)
          : undefined,
      }
    })

  const waitForTask = (
    taskId: string,
    options: AiWaitOptions,
  ): Effect.Effect<AiTaskFinalView, AiTaskFailed | ApiError> =>
    Effect.gen(function* () {
      const pollMs = resolvePollMs(options.pollMs)
      let lastStatus: string | undefined

      const pollOnce = (): Effect.Effect<
        { rec: TaskRecord; status: AiTaskStatus },
        ApiError
      > =>
        api.request(`/tasks/${taskId}`).pipe(
          Effect.flatMap((raw) => {
            const rec = readTaskRecord(raw)
            const status = (rec.status ?? 'pending') as AiTaskStatus
            if (status !== lastStatus) {
              lastStatus = status
              options.onProgress?.(`[ai] task ${status}…`)
            }
            if (TERMINAL.has(status)) return Effect.succeed({ rec, status })
            return Effect.sleep(`${pollMs} millis`).pipe(
              Effect.flatMap(() => pollOnce()),
            )
          }),
        )

      const { rec, status } = yield* pollOnce()
      const final: AiTaskFinalView = {
        type: options.type,
        taskId,
        status,
        refId: rec.payload?.refId,
        targetLanguages: rec.payload?.targetLanguages,
        totalTokens: toNumber(rec.totalTokens),
        totalCost: toNumber(rec.totalCost),
        resultIds: rec.resultIds,
        error:
          typeof rec.error === 'object'
            ? rec.error.message
              ? { message: rec.error.message }
              : undefined
            : rec.errorMessage
              ? { message: rec.errorMessage }
              : undefined,
      }

      if (status === 'failed' || status === 'cancelled') {
        return yield* Effect.fail(
          new AiTaskFailed({
            taskId,
            status,
            message: final.error?.message ?? `AI task ${status} (id=${taskId})`,
            details: final,
          }),
        )
      }
      if (status === 'partial_failed') {
        return yield* Effect.fail(
          new AiTaskFailed({
            taskId,
            status,
            message: final.error?.message ?? `AI task ${status} (id=${taskId})`,
            details: final,
          }),
        )
      }
      return final
    })

  const list =
    <Q extends AiListQuery>(
      base: string,
      flatPath: string | null,
      groupedPath: string,
    ) =>
    (q: Q): Effect.Effect<unknown, ApiError> =>
      api.request(
        q.grouped || flatPath === null
          ? `${base}${groupedPath}`
          : `${base}${flatPath}`,
        {
          query: {
            page: q.page,
            size: q.size,
          },
        },
      )

  const groupedItems = (
    group: unknown,
    itemKeys: ReadonlyArray<string>,
  ): ReadonlyArray<unknown> => {
    const record = asRecord(group)
    for (const key of itemKeys) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
    return []
  }

  const matchById = (
    base: string,
    id: string,
    itemKeys: ReadonlyArray<string>,
  ): Effect.Effect<unknown, AiRecordNotFound | ApiError> =>
    Effect.gen(function* () {
      // Try grouped pagination; flatten and match by id. Capped scan to avoid
      // unbounded pagination on enormous datasets.
      const MAX_PAGES = 50
      const SIZE = 50
      for (let page = 1; page <= MAX_PAGES; page++) {
        const raw = yield* api.request(`${base}/grouped`, {
          query: { page, size: SIZE },
        })
        const data = unwrapData(raw)
        const groups = Array.isArray(data) ? data : []
        for (const group of groups) {
          for (const item of groupedItems(group, itemKeys)) {
            const r = asRecord(item)
            if (typeof r.id === 'string' && r.id === id) return item
          }
        }
        const pagination = asRecord(asRecord(asRecord(raw).meta).pagination)
        const totalPages =
          typeof pagination.totalPages === 'number'
            ? pagination.totalPages
            : groups.length < SIZE
              ? page
              : page + 1
        if (page >= totalPages) break
      }
      return yield* Effect.fail(
        new AiRecordNotFound({
          message: `AI record not found: ${id}`,
          ref: id,
        }),
      )
    })

  const summaryByArticle = (
    refId: string,
    opts?: AiByArticleOptions,
  ): Effect.Effect<unknown, ApiError> =>
    api.request(`/ai/summaries/article/${refId}`, {
      query: {
        lang: opts?.lang,
        onlyDb: opts?.onlyDb,
      },
    })

  const insightsByArticle = (
    refId: string,
    opts?: AiByArticleOptions,
  ): Effect.Effect<unknown, ApiError> =>
    api.request(`/ai/insights/article/${refId}`, {
      query: {
        lang: opts?.lang,
        onlyDb: opts?.onlyDb,
      },
    })

  const translationsByArticle = (
    refId: string,
    opts?: AiByArticleOptions,
  ): Effect.Effect<unknown, ApiError> =>
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
      }),

    translate: (input) =>
      createTask('translation', '/ai/translations/task', {
        refId: input.refId,
        targetLanguages: [...input.targetLanguages],
      }),

    refreshInsights: (input) =>
      createTask('insights', '/ai/insights/task', {
        refId: input.refId,
      }),

    waitForTask,

    // -- summary
    listSummaries: list('/ai/summaries', '/', '/grouped'),
    getSummary: (id) => matchById('/ai/summaries', id, ['summaries']),
    getSummariesByArticle: summaryByArticle,
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
    getInsightsByArticle: insightsByArticle,
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

// ---------------------------------------------------------------------------
// Tag + Layer
// ---------------------------------------------------------------------------

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

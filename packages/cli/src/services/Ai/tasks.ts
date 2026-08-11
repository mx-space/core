import { Effect } from 'effect'

import { AiTaskCreateFailed, AiTaskFailed } from '../../domain/errors'
import type { ApiError, ApiService } from '../Api'
import { asRecord, unwrapData } from './shared'
import type {
  AiTaskCreateResult,
  AiTaskFinalView,
  AiTaskStatus,
  AiTaskType,
  AiWaitOptions,
} from './types'

interface CreateTaskEnvelope {
  taskId?: string
  created?: boolean
  reason?: string
}

const readCreateTask = (raw: unknown): CreateTaskEnvelope => {
  const inner = asRecord(unwrapData(raw))
  return {
    taskId: typeof inner.taskId === 'string' ? inner.taskId : undefined,
    created: typeof inner.created === 'boolean' ? inner.created : undefined,
    reason: typeof inner.reason === 'string' ? inner.reason : undefined,
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

export const makeCreateTask =
  (api: ApiService) =>
  (
    type: AiTaskType,
    path: string,
    body: Record<string, unknown>,
    opts?: { sourceMissingHint?: string },
  ): Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError> =>
    Effect.gen(function* () {
      const raw = yield* api.request(path, { method: 'POST', body })
      const env = readCreateTask(raw)
      if (!env.taskId) {
        return yield* Effect.fail(
          new AiTaskCreateFailed({
            message:
              env.reason === 'source-missing' && opts?.sourceMissingHint
                ? opts.sourceMissingHint
                : 'server returned no taskId',
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
          : Array.isArray(body.langs)
            ? (body.langs as ReadonlyArray<string>)
            : typeof body.targetLang === 'string'
              ? [body.targetLang]
              : undefined,
      }
    })

export const makeWaitForTask =
  (api: ApiService) =>
  (
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

      if (
        status === 'failed' ||
        status === 'cancelled' ||
        status === 'partial_failed'
      ) {
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

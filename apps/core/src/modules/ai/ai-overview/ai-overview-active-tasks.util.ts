import { AITaskType } from '../ai-task/ai-task.types'
import type { ActiveGeneration } from './ai-overview.types'

interface ActiveTaskInput {
  id: string
  type: string
  status: string
  payload?: Record<string, unknown> | null
  progress?: number
  progressMessage?: string
  completedItems?: number
  totalItems?: number
  startedAt?: number
  error?: string
  logs?: Array<{ level: string; message: string }>
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const FAILED_STATUSES = new Set(['failed', 'partial_failed'])

/**
 * Workers that fail per-language record the reason in a log line and leave
 * `error` unset, so a bare `task.error` read reports "failed" with no cause —
 * which is exactly the silence this surfacing exists to break.
 */
function resolveError(task: ActiveTaskInput): string | null {
  if (!FAILED_STATUSES.has(task.status)) return null
  if (task.error) return task.error
  const logged = task.logs?.findLast((log) => log.level === 'error')
  return logged?.message ?? null
}

/**
 * Narrow the queue's in-flight AI tasks down to the ones acting on this
 * article, so the coverage matrix can show a cell as running rather than as a
 * fresh gap — clicking a gap twice would otherwise queue duplicate work.
 *
 * `ai:translation:all` is deliberately ignored: it targets every article at
 * once, so surfacing it would pin a spinner on every row for the duration.
 */
export function toActiveGenerations(
  tasks: ActiveTaskInput[],
  refId: string,
): ActiveGeneration[] {
  const result: ActiveGeneration[] = []

  for (const task of tasks) {
    const payload = task.payload ?? {}
    const base = {
      taskId: task.id,
      status: task.status,
      progress: asNumber(task.progress),
      progressMessage: task.progressMessage ?? null,
      completedItems: asNumber(task.completedItems),
      totalItems: asNumber(task.totalItems),
      startedAt: asNumber(task.startedAt),
      error: resolveError(task),
    }

    switch (task.type) {
      case AITaskType.Summary: {
        if (payload.refId !== refId) continue
        result.push({
          ...base,
          capability: 'summary',
          langs: asStringArray(payload.targetLanguages),
        })
        break
      }
      case AITaskType.SummaryTranslation: {
        if (payload.refId !== refId) continue
        result.push({
          ...base,
          capability: 'summary',
          langs:
            typeof payload.targetLang === 'string' ? [payload.targetLang] : [],
        })
        break
      }
      case AITaskType.Insights: {
        if (payload.refId !== refId) continue
        result.push({
          ...base,
          capability: 'insights',
          langs: asStringArray(payload.targetLanguages),
        })
        break
      }
      case AITaskType.InsightsTranslation: {
        if (payload.refId !== refId) continue
        result.push({
          ...base,
          capability: 'insights',
          langs:
            typeof payload.targetLang === 'string' ? [payload.targetLang] : [],
        })
        break
      }
      case AITaskType.Translation: {
        if (payload.refId !== refId) continue
        result.push({
          ...base,
          capability: 'translation',
          langs: asStringArray(payload.targetLanguages),
        })
        break
      }
      case AITaskType.TranslationBatch: {
        if (!asStringArray(payload.refIds).includes(refId)) continue
        result.push({
          ...base,
          capability: 'translation',
          langs: asStringArray(payload.targetLanguages),
        })
        break
      }
      case AITaskType.Tts: {
        if (payload.refId !== refId) continue
        result.push({
          ...base,
          capability: 'tts',
          langs: asStringArray(payload.langs),
        })
        break
      }
      default: {
        continue
      }
    }
  }

  return result
}

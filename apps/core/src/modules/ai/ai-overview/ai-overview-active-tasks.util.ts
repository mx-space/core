import { AITaskType } from '../ai-task/ai-task.types'
import type { ActiveGeneration } from './ai-overview.types'

interface ActiveTaskInput {
  id: string
  type: string
  status: string
  payload?: Record<string, unknown> | null
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []

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
    const base = { taskId: task.id, status: task.status }

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
      case AITaskType.Insights: {
        if (payload.refId !== refId) continue
        result.push({ ...base, capability: 'insights', langs: [] })
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

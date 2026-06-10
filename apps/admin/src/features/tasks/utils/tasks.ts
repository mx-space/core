import type { AITask, AITaskLog, AITasksResponse } from '~/api/tasks'
import { AITaskStatus, AITaskType } from '~/api/tasks'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import { relativeTimeFromNow } from '~/utils/time'

import type { TaskStatusCategory } from '../constants'
import { statusCategoryOptionKeys, taskTypeLabelKeys } from '../constants'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function getTaskTypeLabel(type: AITask['type'], t: Translator): string {
  const key = taskTypeLabelKeys[type]
  if (key) return t(key)
  const separatorIndex = type.indexOf(':')
  return separatorIndex > 0 ? type.slice(separatorIndex + 1) : type
}

export function getEffectiveStatus(task: AITask) {
  if (
    isBatchTask(task) &&
    task.status === AITaskStatus.Completed &&
    task.subTaskStats &&
    (task.subTaskStats.pending > 0 || task.subTaskStats.running > 0)
  ) {
    return AITaskStatus.Running
  }

  return task.status
}

export function isBatchTask(task: AITask) {
  return (
    task.type === AITaskType.TranslationBatch ||
    task.type === AITaskType.TranslationAll
  )
}

export function getTaskSummary(task: AITask, t: Translator) {
  const payload = task.payload
  const result = task.result as Record<string, unknown> | undefined
  if (task.type === AITaskType.Summary) {
    return (
      (payload.title as string) ||
      (payload.refId as string) ||
      t('tasks.task.summary.task')
    )
  }
  if (task.type === AITaskType.Translation) {
    return (
      (payload.title as string) ||
      (payload.refId as string) ||
      t('tasks.task.translation.task')
    )
  }
  if (task.type === AITaskType.TranslationBatch) {
    const count = (payload.refIds as string[] | undefined)?.length ?? 0
    return t('tasks.task.translation.articleCount', { count })
  }
  if (task.type === AITaskType.TranslationAll) {
    const count = result?.total as number | undefined
    return count
      ? t('tasks.task.translation.articleCount', { count })
      : t('tasks.task.translation.allArticles')
  }
  if (task.type === AITaskType.SlugBackfill)
    return t('tasks.task.slugBackfill.summary')
  if (task.type === AITaskType.Insights)
    return t('tasks.task.insights.generation')
  if (task.type === AITaskType.InsightsTranslation)
    return t('tasks.task.insights.translation')

  const refId = task.payload.refId
  if (typeof refId === 'string' && refId) return refId
  return task.type
}

export function getTaskDetailSummary(task: AITask, t: Translator) {
  const payload = task.payload
  const result = task.result as Record<string, unknown> | undefined
  if (task.type === AITaskType.Translation) {
    const title = (payload.title as string) || (payload.refId as string)
    const langs = (payload.targetLanguages as string[] | undefined)?.join(', ')
    return `${title || t('tasks.task.translation.task')} -> ${langs || t('tasks.task.translation.defaultLang')}`
  }
  if (task.type === AITaskType.TranslationBatch) {
    const count = (payload.refIds as string[] | undefined)?.length ?? 0
    const langs = (payload.targetLanguages as string[] | undefined)?.join(', ')
    return `${t('tasks.task.translation.articleCount', { count })} -> ${langs || t('tasks.task.translation.defaultLang')}`
  }
  if (task.type === AITaskType.TranslationAll) {
    const count = result?.total as number | undefined
    const langs = (payload.targetLanguages as string[] | undefined)?.join(', ')
    const head = count
      ? t('tasks.task.translation.allArticlesCount', { count })
      : t('tasks.task.translation.allArticles')
    return `${head} -> ${langs || t('tasks.task.translation.defaultLang')}`
  }

  return getTaskSummary(task, t)
}

export function getTaskProgressLabel(task: AITask) {
  if (task.subTaskStats) {
    const stats = task.subTaskStats
    return `${stats.completed + stats.failed}/${stats.total}`
  }

  if (
    typeof task.completedItems === 'number' &&
    typeof task.totalItems === 'number' &&
    task.totalItems > 0
  ) {
    return `${task.completedItems}/${task.totalItems}`
  }

  return null
}

export function getProgress(task: AITask) {
  if (typeof task.progress === 'number') return task.progress
  if (
    typeof task.completedItems === 'number' &&
    typeof task.totalItems === 'number' &&
    task.totalItems > 0
  ) {
    return (task.completedItems / task.totalItems) * 100
  }
  if (task.subTaskStats && task.subTaskStats.total > 0) {
    const completed = task.subTaskStats.completed + task.subTaskStats.failed
    return (completed / task.subTaskStats.total) * 100
  }

  return null
}

export function statusIconClassName(status: AITaskStatus) {
  return {
    [AITaskStatus.Pending]: 'text-fg-subtle',
    [AITaskStatus.Running]: 'text-blue-500',
    [AITaskStatus.Completed]: 'text-emerald-500',
    [AITaskStatus.PartialFailed]: 'text-amber-500',
    [AITaskStatus.Failed]: 'text-red-500',
    [AITaskStatus.Cancelled]: 'text-fg-subtle',
  }[status]
}

export function formatTaskDuration(task: AITask) {
  if (!task.startedAt || !task.completedAt) return null
  const ms = task.completedAt - task.startedAt
  if (ms < 0) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatRelativeTimestamp(timestamp?: number) {
  if (!timestamp) return '-'
  return relativeTimeFromNow(new Date(timestamp))
}

export function formatAbsoluteTimestamp(timestamp?: number) {
  if (!timestamp) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp))
}

export function readPositivePage(value: null | string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export function readTaskStatusFilter(
  value: null | string,
): TaskStatusCategory | '' {
  return statusCategoryOptionKeys.some((option) => option.value === value)
    ? (value as TaskStatusCategory | '')
    : ''
}

export function readTaskTypeFilter(value: null | string): string {
  return value ?? ''
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function applyTaskPatch(
  prev: AITask,
  patch?: Partial<AITask>,
  log?: AITaskLog,
): AITask {
  if (!patch && !log) return prev

  const next: AITask = { ...prev }
  let changed = false

  if (patch) {
    const fields = [
      'status',
      'progress',
      'progressMessage',
      'tokensGenerated',
      'cost',
      'result',
      'error',
      'completedAt',
      'completedItems',
      'totalItems',
      'startedAt',
      'workerId',
      'retryCount',
      'groupId',
    ] as const
    const patchRecord = patch as Record<string, unknown>
    const nextRecord = next as unknown as Record<string, unknown>
    for (const key of fields) {
      if (key in patchRecord && patchRecord[key] !== undefined) {
        nextRecord[key] = patchRecord[key]
        changed = true
      }
    }
    if (patch.subTaskStats) {
      next.subTaskStats = patch.subTaskStats
      changed = true
    }
  }

  if (log) {
    next.logs = [...(prev.logs ?? []), log]
    changed = true
  }

  return changed ? next : prev
}

function isTasksListResponse(value: unknown): value is AITasksResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as AITasksResponse).data) &&
    typeof (value as AITasksResponse).total === 'number'
  )
}

export function prependTaskToList(
  data: unknown,
  task: AITask,
): AITasksResponse | unknown {
  if (!isTasksListResponse(data)) return data
  if (data.data.some((t) => t.id === task.id)) {
    return upsertTaskInList(data, task.id, task)
  }
  return {
    ...data,
    data: [task, ...data.data],
    total: data.total + 1,
  }
}

export function upsertTaskInList(
  data: unknown,
  id: string,
  patch: Partial<AITask>,
): AITasksResponse | unknown {
  if (!isTasksListResponse(data)) return data
  const idx = data.data.findIndex((t) => t.id === id)
  if (idx < 0) return data
  const prev = data.data[idx]
  const merged = applyTaskPatch(prev, patch)
  if (merged === prev) return data
  const nextData = data.data.slice()
  nextData[idx] = merged
  return { ...data, data: nextData }
}

export function removeTaskFromList(
  data: unknown,
  id: string,
): AITasksResponse | unknown {
  if (!isTasksListResponse(data)) return data
  const idx = data.data.findIndex((t) => t.id === id)
  if (idx < 0) return data
  const nextData = data.data.slice()
  nextData.splice(idx, 1)
  return {
    ...data,
    data: nextData,
    total: Math.max(0, data.total - 1),
  }
}

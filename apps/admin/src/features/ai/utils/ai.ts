import type { AIInsights, AISummary, AITask, AITranslation } from '~/api/ai'
import type { TranslationKey, TranslationValues } from '~/i18n/types'

import {
  AITaskStatus,
  AITaskType,
  updateInsights,
  updateSummary,
  updateTranslation,
} from '~/api/ai'
import { relativeTimeFromNow } from '~/utils/time'

import { statusOptionKeys, typeOptionKeys } from '../constants'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

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
      t('ai.task.summary.task')
    )
  }
  if (task.type === AITaskType.Translation) {
    return (
      (payload.title as string) ||
      (payload.refId as string) ||
      t('ai.task.translation.task')
    )
  }
  if (task.type === AITaskType.TranslationBatch) {
    const count = (payload.refIds as string[] | undefined)?.length ?? 0
    return t('ai.task.translation.articleCount', { count })
  }
  if (task.type === AITaskType.TranslationAll) {
    const count = result?.total as number | undefined
    return count
      ? t('ai.task.translation.articleCount', { count })
      : t('ai.task.translation.allArticles')
  }
  if (task.type === AITaskType.SlugBackfill)
    return t('ai.task.slugBackfill.summary')
  if (task.type === AITaskType.Insights) return t('ai.task.insights.generation')
  if (task.type === AITaskType.InsightsTranslation)
    return t('ai.task.insights.translation')

  return t('ai.task.fallback')
}

export function getTaskDetailSummary(task: AITask, t: Translator) {
  const payload = task.payload
  const result = task.result as Record<string, unknown> | undefined
  if (task.type === AITaskType.Translation) {
    const title = (payload.title as string) || (payload.refId as string)
    const langs = (payload.targetLanguages as string[] | undefined)?.join(', ')
    return `${title || t('ai.task.translation.task')} -> ${langs || t('ai.task.translation.defaultLang')}`
  }
  if (task.type === AITaskType.TranslationBatch) {
    const count = (payload.refIds as string[] | undefined)?.length ?? 0
    const langs = (payload.targetLanguages as string[] | undefined)?.join(', ')
    return `${t('ai.task.translation.articleCount', { count })} -> ${langs || t('ai.task.translation.defaultLang')}`
  }
  if (task.type === AITaskType.TranslationAll) {
    const count = result?.total as number | undefined
    const langs = (payload.targetLanguages as string[] | undefined)?.join(', ')
    const head = count
      ? t('ai.task.translation.allArticlesCount', { count })
      : t('ai.task.translation.allArticles')
    return `${head} -> ${langs || t('ai.task.translation.defaultLang')}`
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
    [AITaskStatus.Pending]: 'text-neutral-400',
    [AITaskStatus.Running]: 'text-blue-500',
    [AITaskStatus.Completed]: 'text-emerald-500',
    [AITaskStatus.PartialFailed]: 'text-amber-500',
    [AITaskStatus.Failed]: 'text-red-500',
    [AITaskStatus.Cancelled]: 'text-neutral-400',
  }[status]
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

export function editSummaryItem(item: AISummary, t: Translator) {
  const summary = window.prompt(t('ai.edit.summaryPrompt'), item.summary)
  if (summary === null) return Promise.resolve({ cancelled: true })
  if (!summary.trim()) throw new Error(t('ai.edit.summaryEmpty'))

  return updateSummary(item.id, { summary })
}

export function editTranslationItem(item: AITranslation, t: Translator) {
  const title = window.prompt(t('ai.edit.titlePrompt'), item.title)
  if (title === null) return Promise.resolve({ cancelled: true })
  if (!title.trim()) throw new Error(t('ai.edit.titleEmpty'))

  const subtitle = window.prompt(
    t('ai.edit.subtitlePrompt'),
    item.subtitle ?? '',
  )
  if (subtitle === null) return Promise.resolve({ cancelled: true })

  const summary = window.prompt(
    t('ai.edit.summaryOptionalPrompt'),
    item.summary ?? '',
  )
  if (summary === null) return Promise.resolve({ cancelled: true })

  if (item.contentFormat === 'lexical') {
    const content = window.prompt(
      t('ai.edit.lexicalPrompt'),
      item.content ?? '',
    )
    if (content === null) return Promise.resolve({ cancelled: true })

    return updateTranslation(item.id, {
      content: content.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      summary: summary.trim() || undefined,
      title,
    })
  }

  const text = window.prompt(t('ai.edit.textPrompt'), item.text)
  if (text === null) return Promise.resolve({ cancelled: true })
  if (!text.trim()) throw new Error(t('ai.edit.textEmpty'))

  return updateTranslation(item.id, {
    subtitle: subtitle.trim() || undefined,
    summary: summary.trim() || undefined,
    text,
    title,
  })
}

export function editInsightsItem(item: AIInsights, t: Translator) {
  const content = window.prompt(t('ai.edit.insightsPrompt'), item.content)
  if (content === null) return Promise.resolve({ cancelled: true })
  if (!content.trim()) throw new Error(t('ai.edit.insightsEmpty'))

  return updateInsights(item.id, { content })
}

export function getGroupedActionSuccessMessage(result: unknown, t: Translator) {
  if (isCancelledActionResult(result)) return null
  return getTaskMutationMessage(result, t) ?? t('ai.toast.saved')
}

export function getTaskMutationMessage(result: unknown, t: Translator) {
  if (isCancelledActionResult(result)) return null
  if (
    result &&
    typeof result === 'object' &&
    'taskId' in result &&
    'created' in result
  ) {
    return (result as { created?: boolean }).created
      ? t('ai.toast.taskCreated')
      : t('ai.toast.taskExists')
  }

  return null
}

export function isCancelledActionResult(result: unknown): result is {
  cancelled: true
} {
  return (
    !!result &&
    typeof result === 'object' &&
    'cancelled' in result &&
    (result as { cancelled?: unknown }).cancelled === true
  )
}

export function formatDateString(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function readPositivePage(value: null | string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export function readTaskStatusFilter(value: null | string): AITaskStatus | '' {
  return statusOptionKeys.some((option) => option.value === value)
    ? (value as AITaskStatus | '')
    : ''
}

export function readTaskTypeFilter(value: null | string): AITaskType | '' {
  return typeOptionKeys.some((option) => option.value === value)
    ? (value as AITaskType | '')
    : ''
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

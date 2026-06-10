import type { AIInsights, AISummary, AITranslation } from '~/api/ai'
import { updateInsights, updateSummary, updateTranslation } from '~/api/ai'
import type { TranslationKey, TranslationValues } from '~/i18n/types'

export { getErrorMessage } from '~/features/tasks/utils/tasks'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

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

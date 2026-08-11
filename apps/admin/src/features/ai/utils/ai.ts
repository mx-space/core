import { normalizeTargetLang } from '@mx-space/ai'

import type { AIInsights, AISummary, AITranslation } from '~/api/ai'
import { updateInsights, updateSummary, updateTranslation } from '~/api/ai'
import type { TranslationKey, TranslationValues } from '~/i18n/types'

export { getErrorMessage } from '~/features/tasks/utils/tasks'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function parseLangInput(raw: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const segment of raw.split(/[,，]/)) {
    // Fold with the server's own canonicalizer: the chips shown here must name
    // the languages the backend will actually generate, or a typed `jp` reads
    // back as a `ja` row the board can never match to its column.
    const lang = normalizeTargetLang(segment)
    if (!lang || seen.has(lang)) continue
    seen.add(lang)
    result.push(lang)
  }
  return result
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

// Every row the TTS management page can act on already has narration, so
// without `force` planTts reuses each unchanged chunk and the enqueue is a
// no-op.
export function buildTtsRegeneratePayload(row: {
  lang: string
  refId: string
}) {
  return { force: true, langs: [row.lang], refId: row.refId }
}

// An empty blockOrder is the pipeline's "not published yet" sentinel: the run
// was interrupted after committing some chunks but before finalize. Re-running
// without `force` reuses every committed chunk and generates only the rest.
export function isTtsNarrationIncomplete(row: { blockOrder: string[] }) {
  return row.blockOrder.length === 0
}

export function buildTtsResumePayload(row: { lang: string; refId: string }) {
  return { force: false, langs: [row.lang], refId: row.refId }
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

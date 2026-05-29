import type { TranslationKey, TranslationValues } from '~/i18n/types'

export function buildEditUrl(refType: string, refId: string) {
  switch (refType) {
    case 'note':
      return `/notes/edit?id=${encodeURIComponent(refId)}`
    case 'page':
      return `/pages/edit?id=${encodeURIComponent(refId)}`
    case 'post':
      return `/posts/edit?id=${encodeURIComponent(refId)}`
    default:
      return null
  }
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function formatRelativeDate(value: string, t: Translator) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const absolute = Math.abs(diff)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (Number.isNaN(date.getTime())) return '-'
  if (absolute < minute) return t('searchIndex.relative.justNow')
  if (absolute < hour)
    return t('searchIndex.relative.minutesAgo', {
      count: Math.round(diff / minute),
    })
  if (absolute < day)
    return t('searchIndex.relative.hoursAgo', {
      count: Math.round(diff / hour),
    })

  return formatDateTime(value)
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

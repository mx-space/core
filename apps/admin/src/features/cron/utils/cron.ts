import type { TranslationKey, TranslationValues } from '~/i18n/types'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function formatNullableDate(
  value: string | null | undefined,
  t: Translator,
) {
  if (!value) return t('cron.next.empty')

  return t('cron.next.value', { time: formatDateTime(value) })
}

export function formatDateTime(value: number | string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatLogTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function formatRelativeDate(value: number, t: Translator) {
  const diff = Date.now() - value
  const absolute = Math.abs(diff)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (absolute < minute) return t('cron.relative.justNow')
  if (absolute < hour)
    return t('cron.relative.minutesAgo', { count: Math.round(diff / minute) })
  if (absolute < day)
    return t('cron.relative.hoursAgo', { count: Math.round(diff / hour) })

  return formatDateTime(value)
}

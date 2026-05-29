import type { Locale } from './types'

export function formatDateTime(
  value: Date | number | string | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
) {
  if (value == null || value === '') return 'N/A'
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date)
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatRelativeTime(
  value: Date | number | string | null | undefined,
  locale: Locale,
  current = new Date(),
) {
  if (value == null || value === '') return '-'
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  const elapsedSeconds = Math.round((date.getTime() - current.getTime()) / 1000)
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 30, unit: 'day' },
    { amount: 12, unit: 'month' },
  ] as const

  let duration = elapsedSeconds
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        duration,
        division.unit,
      )
    }
    duration = Math.round(duration / division.amount)
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    duration,
    'year',
  )
}

import type { DeviceDistributionResponse, IPAggregate } from '~/api/analyze'
import type { TranslationKey, TranslationValues } from '~/i18n/types'

import type {
  ActivityListResponseObjects,
  AnalyzePeriod,
  TimeRange,
  TrendPoint,
} from '../types/analyze'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function buildTrendData(
  aggregate: IPAggregate | undefined,
  period: AnalyzePeriod,
): TrendPoint[] {
  if (!aggregate) return []

  const source =
    period === 'day'
      ? aggregate.today
      : period === 'week'
        ? aggregate.weeks
        : aggregate.months
  const map = new Map<string, TrendPoint>()

  for (const item of source) {
    const label =
      'hour' in item
        ? item.hour
        : 'day' in item
          ? item.day
          : formatMonthDate(item.date)
    const current = map.get(label) ?? { ip: 0, label, pv: 0 }

    if (item.key === 'pv') current.pv = item.value
    else current.ip = item.value

    map.set(label, current)
  }

  return Array.from(map.values())
}

export function buildRefObjectMap(
  objects: ActivityListResponseObjects | undefined,
): Map<string, { id: string; title?: string }> {
  const map = new Map<string, { id: string; title?: string }>()

  if (!objects) return map
  ;[
    ...(objects.posts ?? []),
    ...(objects.notes ?? []),
    ...(objects.pages ?? []),
    ...(objects.recentlies ?? []),
  ].forEach((item) => {
    map.set(item.id, item)
  })

  return map
}

export function getTimeWindow(range: TimeRange): {
  start: number
  end: number
} {
  const end = Date.now()
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30
  return { end, start: end - days * 24 * 60 * 60 * 1000 }
}

export function formatDuration(value: number, t: Translator) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return t('analyze.duration.hms', { hours, minutes, seconds })
  if (minutes > 0) return t('analyze.duration.ms', { minutes, seconds })
  return t('analyze.duration.s', { seconds })
}

export function formatMonthDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatNumber(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '-'
}

export function formatAverageDepth(pv?: number, uv?: number) {
  if (!pv || !uv) return '0'
  return (pv / uv).toFixed(1)
}

export function hasDeviceDistribution(
  data: DeviceDistributionResponse | undefined,
): data is DeviceDistributionResponse {
  return Boolean(
    data &&
    (data.devices.length > 0 || data.browsers.length > 0 || data.os.length > 0),
  )
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

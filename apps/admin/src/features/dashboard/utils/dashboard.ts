import type {
  ClosedUpdateTipKey,
  ClosedUpdateTips,
  SearchIndexRebuildStats,
} from '../types/dashboard'

import { translate } from '~/i18n/translate'

import { closedUpdateTipsStorageKey } from '../constants'

export function formatNumber(value: number | string) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-US').format(value)
    : value
}

export function formatSearchIndexStats(result: SearchIndexRebuildStats) {
  return translate('dashboard.searchIndex.stats', {
    created: result.created,
    deleted: result.deleted,
    skipped: result.skipped,
    total: result.total,
    updated: result.updated,
  })
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function readClosedUpdateTips(): ClosedUpdateTips {
  try {
    return {
      dashboard: null,
      system: null,
      ...(JSON.parse(
        localStorage.getItem(closedUpdateTipsStorageKey) || '{}',
      ) as {
        dashboard?: null | string
        system?: null | string
      }),
    }
  } catch {
    return {
      dashboard: null,
      system: null,
    }
  }
}

export function writeClosedUpdateTip(
  type: ClosedUpdateTipKey,
  version: string,
) {
  const tips = readClosedUpdateTips()
  localStorage.setItem(
    closedUpdateTipsStorageKey,
    JSON.stringify({
      ...tips,
      [type]: version,
    }),
  )
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

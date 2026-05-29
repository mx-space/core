import { LinkState } from '~/models/link'

import { stateTabs } from '../constants'

export function normalizeState(value: string | null): LinkState {
  const numeric = Number(value)
  return stateTabs.some((tab) => tab.value === numeric)
    ? numeric
    : LinkState.Pass
}

export function readPage(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

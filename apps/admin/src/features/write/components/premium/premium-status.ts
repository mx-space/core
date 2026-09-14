import {
  DEFAULT_FREE_WINDOW_HOURS,
  DEFAULT_PREVIEW_BLOCKS,
} from './paywall-meta'

export type PremiumStatus =
  | { kind: 'pending'; freeWindowHours: number }
  | { kind: 'pending-save'; freeWindowHours: number }
  | { kind: 'free-window'; freeUntil: Date; remainingMs: number }
  | { kind: 'archived'; previewBlocks: number }

export function derivePremiumStatus(
  input: {
    freeUntil?: string
    freeWindowHours?: number
    isPublished: boolean
    previewBlocks?: number
  },
  now: Date,
): PremiumStatus {
  if (!input.isPublished) {
    return {
      kind: 'pending',
      freeWindowHours: input.freeWindowHours ?? DEFAULT_FREE_WINDOW_HOURS,
    }
  }
  const freeUntil = input.freeUntil ? new Date(input.freeUntil) : null
  if (!freeUntil || Number.isNaN(freeUntil.getTime())) {
    return {
      kind: 'pending-save',
      freeWindowHours: input.freeWindowHours ?? DEFAULT_FREE_WINDOW_HOURS,
    }
  }
  const remainingMs = freeUntil.getTime() - now.getTime()
  if (remainingMs > 0) return { kind: 'free-window', freeUntil, remainingMs }
  return {
    kind: 'archived',
    previewBlocks: input.previewBlocks ?? DEFAULT_PREVIEW_BLOCKS,
  }
}

const HOUR_MS = 60 * 60 * 1000

export function splitDuration(ms: number) {
  const totalHours = Math.max(0, Math.ceil(ms / HOUR_MS))
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 }
}

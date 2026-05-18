import { ANSI, wrap } from './markdown'

export const SEPARATOR_WIDTH = 64

export const formatStateBadge = (
  raw: unknown,
  color: boolean,
): string | undefined => {
  if (typeof raw !== 'string') return undefined
  if (raw === 'published') return wrap(ANSI.green, raw, color)
  if (raw === 'draft') return wrap(ANSI.yellow, raw, color)
  return raw
}

// ---------------------------------------------------------------------------
// Human-friendly date/time formatting for readable CLI output.
//
// Why this file exists: the legacy renderers stringified API timestamps
// directly, which left raw ISO 8601 like `2026-05-19T14:32:00.000Z` in
// every `readable` field. That format is precise but hard to scan. The
// helpers here keep ISO as a normalization step and emit a friendlier
// surface form for human consumption.
//
// Two surface forms are exposed:
//
//   - `abs`  → `YYYY-MM-DD HH:mm` in the local timezone (default).
//   - `rel`  → "3 days ago" / "in 2 hours".
//   - `both` → `YYYY-MM-DD HH:mm (3 days ago)`.
//
// `--json` / `--pretty-json` are unaffected: those paths stringify the raw
// data shape and never invoke the view layer.
// ---------------------------------------------------------------------------

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Coerce an arbitrary value (ISO string, epoch ms or s, Date) into a Date.
 * Returns null when the value cannot be interpreted as a calendar time.
 */
export const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    // Heuristic: values below 1e12 are seconds since epoch (covers 2001+).
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/** Local-time `YYYY-MM-DD HH:mm`. Seconds are dropped for readability. */
export const formatAbsoluteDateTime = (date: Date): string => {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  const hh = pad2(date.getHours())
  const mm = pad2(date.getMinutes())
  return `${y}-${m}-${d} ${hh}:${mm}`
}

const phrase = (count: number, unit: string, past: boolean): string => {
  const plural = count === 1 ? unit : `${unit}s`
  return past ? `${count} ${plural} ago` : `in ${count} ${plural}`
}

/**
 * Relative phrase versus `now` (default = the moment of the call).
 * Bucketing uses the same thresholds as date-fns `formatDistance` so the
 * output reads naturally without 1-minute precision noise.
 */
export const formatRelativeTime = (date: Date, now: Date = new Date()): string => {
  const diffMs = date.getTime() - now.getTime()
  const past = diffMs < 0
  const seconds = Math.abs(diffMs) / 1000
  if (seconds < 45) return past ? 'just now' : 'in a moment'
  if (seconds < 90) return phrase(1, 'minute', past)
  const minutes = Math.round(seconds / 60)
  if (minutes < 45) return phrase(minutes, 'minute', past)
  if (minutes < 90) return phrase(1, 'hour', past)
  const hours = Math.round(minutes / 60)
  if (hours < 22) return phrase(hours, 'hour', past)
  if (hours < 36) return phrase(1, 'day', past)
  const days = Math.round(hours / 24)
  if (days < 7) return phrase(days, 'day', past)
  if (days < 11) return phrase(1, 'week', past)
  const weeks = Math.round(days / 7)
  if (weeks < 5) return phrase(weeks, 'week', past)
  if (days < 60) return phrase(1, 'month', past)
  const months = Math.round(days / 30)
  if (months < 12) return phrase(months, 'month', past)
  const years = Math.round(days / 365.25)
  return phrase(years, 'year', past)
}

export type DateTimeStyle = 'abs' | 'rel' | 'both'

export interface FormatDateTimeOptions {
  /** `abs` (default) → `YYYY-MM-DD HH:mm`; `rel` → relative phrase; `both` → abs (rel). */
  readonly style?: DateTimeStyle
  /** Shortcut for `style: 'both'`. */
  readonly relative?: boolean
  /** Override "now" — primarily for tests. */
  readonly now?: Date
}

/**
 * Format an arbitrary timestamp-shaped value for a readable view.
 *
 * Falls back to `String(value)` when the value cannot be parsed as a date,
 * and to `''` when the value is nullish — letting the caller filter the
 * field out instead of rendering `null` / `undefined`.
 */
export const formatDateTime = (
  value: unknown,
  opts: FormatDateTimeOptions = {},
): string => {
  const date = toDate(value)
  if (!date) {
    if (value === null || value === undefined) return ''
    return String(value)
  }
  const style: DateTimeStyle =
    opts.style ?? (opts.relative ? 'both' : 'abs')
  if (style === 'rel') return formatRelativeTime(date, opts.now)
  const abs = formatAbsoluteDateTime(date)
  if (style === 'both') {
    const rel = formatRelativeTime(date, opts.now)
    return rel ? `${abs} (${rel})` : abs
  }
  return abs
}

// ---------------------------------------------------------------------------
// Auto-detection helpers (used by generic readable renderers).
// ---------------------------------------------------------------------------

// ISO-8601-ish detector: matches both `2026-05-19T14:32:00Z` and the space
// variant `2026-05-19 14:32:00`. Date-only strings (`2026-05-19`) are
// intentionally NOT matched — they often appear as opaque ids/slugs.
const ISO_LIKE_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/

/** True when `value` is a `Date` or an ISO-8601-ish string. */
export const looksLikeTimestamp = (value: unknown): boolean => {
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (typeof value === 'string') return ISO_LIKE_RE.test(value)
  return false
}

/**
 * Format `value` as a human-friendly timestamp when it looks like one;
 * return `null` otherwise so the caller can fall back to its scalar
 * formatter without committing to the timestamp shape.
 */
export const tryFormatTimestamp = (
  value: unknown,
  opts: FormatDateTimeOptions = {},
): string | null => {
  if (!looksLikeTimestamp(value)) return null
  return formatDateTime(value, opts)
}

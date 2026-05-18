import { describe, expect, it } from '@effect/vitest'

import {
  formatAbsoluteDateTime,
  formatDateTime,
  formatRelativeTime,
  looksLikeTimestamp,
  toDate,
  tryFormatTimestamp,
} from '../../src/services/Renderer/datetime'

describe('toDate', () => {
  it('returns null for nullish values', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate('  ')).toBeNull()
  })

  it('parses ISO strings', () => {
    const d = toDate('2026-05-19T14:32:00.000Z')
    expect(d).not.toBeNull()
    expect(d!.getUTCFullYear()).toBe(2026)
    expect(d!.getUTCMonth()).toBe(4)
    expect(d!.getUTCDate()).toBe(19)
  })

  it('treats large numbers as milliseconds and small numbers as seconds', () => {
    const ms = 1747668720000 // 2025-05-19T..
    const s = ms / 1000
    expect(toDate(ms)?.getTime()).toBe(ms)
    expect(toDate(s)?.getTime()).toBe(ms)
  })

  it('rejects non-positive or NaN numbers', () => {
    expect(toDate(0)).toBeNull()
    expect(toDate(-1)).toBeNull()
    expect(toDate(Number.NaN)).toBeNull()
    expect(toDate(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('preserves Date instances unless invalid', () => {
    const d = new Date('2026-05-19T14:32:00.000Z')
    expect(toDate(d)).toBe(d)
    expect(toDate(new Date('invalid'))).toBeNull()
  })
})

describe('formatAbsoluteDateTime', () => {
  it('emits YYYY-MM-DD HH:mm in local time', () => {
    const date = new Date(2026, 4, 19, 14, 5)
    expect(formatAbsoluteDateTime(date)).toBe('2026-05-19 14:05')
  })

  it('zero-pads month, day, hour, and minute', () => {
    const date = new Date(2026, 0, 1, 1, 7)
    expect(formatAbsoluteDateTime(date)).toBe('2026-01-01 01:07')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-19T14:00:00.000Z')

  it('renders "just now" for very recent past', () => {
    expect(
      formatRelativeTime(new Date('2026-05-19T13:59:30.000Z'), now),
    ).toBe('just now')
  })

  it('renders pluralized minutes', () => {
    expect(
      formatRelativeTime(new Date('2026-05-19T13:55:00.000Z'), now),
    ).toBe('5 minutes ago')
  })

  it('uses singular for exactly 1 unit', () => {
    expect(
      formatRelativeTime(new Date('2026-05-19T13:00:00.000Z'), now),
    ).toBe('1 hour ago')
  })

  it('renders future as "in N units"', () => {
    expect(
      formatRelativeTime(new Date('2026-05-20T14:00:00.000Z'), now),
    ).toBe('in 1 day')
  })

  it('caps long horizons at years', () => {
    expect(
      formatRelativeTime(new Date('2023-05-19T14:00:00.000Z'), now),
    ).toBe('3 years ago')
  })
})

describe('formatDateTime style switch', () => {
  const fixedNow = new Date('2026-05-19T14:00:00.000Z')

  it('defaults to absolute form', () => {
    const out = formatDateTime('2026-05-19T13:55:00.000Z', { now: fixedNow })
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('"both" appends the relative phrase in parens', () => {
    const out = formatDateTime('2026-05-19T13:55:00.000Z', {
      style: 'both',
      now: fixedNow,
    })
    expect(out).toContain('(5 minutes ago)')
  })

  it('"rel" omits the absolute portion', () => {
    const out = formatDateTime('2026-05-19T13:55:00.000Z', {
      style: 'rel',
      now: fixedNow,
    })
    expect(out).toBe('5 minutes ago')
  })

  it('returns empty for nullish, raw string fallback for unparseable values', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('looksLikeTimestamp / tryFormatTimestamp', () => {
  it('matches ISO 8601 with T separator', () => {
    expect(looksLikeTimestamp('2026-05-19T14:00:00.000Z')).toBe(true)
  })

  it('matches the space variant', () => {
    expect(looksLikeTimestamp('2026-05-19 14:00:00')).toBe(true)
  })

  it('rejects date-only strings and arbitrary identifiers', () => {
    expect(looksLikeTimestamp('2026-05-19')).toBe(false)
    expect(looksLikeTimestamp('post-slug-2026')).toBe(false)
    expect(looksLikeTimestamp('123456789012345')).toBe(false)
    expect(looksLikeTimestamp(12345)).toBe(false)
  })

  it('returns null when value is not timestamp-shaped', () => {
    expect(tryFormatTimestamp('hello')).toBeNull()
    expect(tryFormatTimestamp(42)).toBeNull()
  })

  it('formats valid timestamps with the given style', () => {
    const fixedNow = new Date('2026-05-19T14:00:00.000Z')
    expect(
      tryFormatTimestamp('2026-05-19T13:55:00.000Z', {
        style: 'rel',
        now: fixedNow,
      }),
    ).toBe('5 minutes ago')
  })
})

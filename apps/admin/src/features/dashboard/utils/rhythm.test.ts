import { describe, expect, it } from 'vitest'

import { buildWeeklyRhythm, buildWeekStrip } from './rhythm'

describe('buildWeeklyRhythm', () => {
  it('buckets days into 52 monday-start weeks and computes streak', () => {
    const now = new Date(2026, 8, 14)
    const rhythm = buildWeeklyRhythm(
      [
        { count: 2, date: '2026-09-14', notes: 1, posts: 1 },
        { count: 1, date: '2026-09-20', notes: 0, posts: 1 },
        { count: 1, date: '2026-09-09', notes: 1, posts: 0 },
        { count: 1, date: '2025-01-01', notes: 1, posts: 0 },
      ],
      now,
    )
    expect(rhythm.weeks).toHaveLength(52)
    expect(rhythm.weeks.at(-1)).toMatchObject({ notes: 1, posts: 2 })
    expect(rhythm.weeks.at(-2)).toMatchObject({ notes: 1, posts: 0 })
    expect(rhythm.thisWeek).toBe(3)
    expect(rhythm.streak).toBe(2)
    expect(rhythm.total).toBe(4)
    expect(rhythm.max).toBe(3)
  })
})

describe('buildWeekStrip', () => {
  it('marks published and scheduled days in the monday-start week', () => {
    const strip = buildWeekStrip(
      [
        { count: 1, date: '2026-09-23', notes: 0, posts: 1 },
        { count: 0, date: '2026-09-24', notes: 0, posts: 0 },
        { count: 2, date: '2026-09-19', notes: 2, posts: 0 },
      ],
      [new Date(2026, 8, 27, 9).toISOString()],
      new Date(2026, 8, 26, 15),
    )
    expect(strip.map((day) => day.key)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ])
    expect(strip.filter((day) => day.published).map((day) => day.key)).toEqual([
      '2026-09-23',
    ])
    expect(strip.filter((day) => day.scheduled).map((day) => day.key)).toEqual([
      '2026-09-27',
    ])
    expect(strip.find((day) => day.isToday)?.key).toBe('2026-09-26')
  })
})

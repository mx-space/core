import { describe, expect, it } from 'vitest'

import { buildWeeklyRhythm } from './rhythm'

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

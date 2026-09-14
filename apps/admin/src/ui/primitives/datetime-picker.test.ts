import { describe, expect, it } from 'vitest'

import { applyTime, TIME_OPTIONS } from './datetime-picker'

describe('applyTime', () => {
  it('keeps the day and replaces the time', () => {
    expect(applyTime(new Date(2026, 8, 14, 15, 29), 23, 30)).toBe(
      '2026-09-14T23:30',
    )
  })

  it('falls back to today when no value is selected', () => {
    const today = new Date()
    expect(applyTime(null, 9, 0)).toBe(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T09:00`,
    )
  })

  it('lists 30-minute slots', () => {
    expect(TIME_OPTIONS).toHaveLength(48)
    expect(TIME_OPTIONS[47].label).toBe('23:30')
  })
})

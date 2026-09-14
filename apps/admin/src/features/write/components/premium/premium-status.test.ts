import { describe, expect, it } from 'vitest'

import { derivePremiumStatus, splitDuration } from './premium-status'

const now = new Date('2026-09-14T12:00:00Z')

describe('derivePremiumStatus', () => {
  it('reports pending with the configured window before publish', () => {
    expect(
      derivePremiumStatus({ isPublished: false, freeWindowHours: 24 }, now),
    ).toEqual({ kind: 'pending', freeWindowHours: 24 })
  })

  it('defaults the pending window to 72 hours', () => {
    expect(derivePremiumStatus({ isPublished: false }, now)).toEqual({
      kind: 'pending',
      freeWindowHours: 72,
    })
  })

  it('ignores freeUntil while unpublished', () => {
    expect(
      derivePremiumStatus(
        { isPublished: false, freeUntil: '2026-09-20T00:00:00Z' },
        now,
      ).kind,
    ).toBe('pending')
  })

  it('reports free-window while now < freeUntil', () => {
    const status = derivePremiumStatus(
      { isPublished: true, freeUntil: '2026-09-17T01:30:00Z' },
      now,
    )
    expect(status.kind).toBe('free-window')
    if (status.kind === 'free-window') {
      expect(status.remainingMs).toBe(
        2.5 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000,
      )
    }
  })

  it('reports archived once freeUntil has passed', () => {
    expect(
      derivePremiumStatus(
        {
          isPublished: true,
          freeUntil: '2026-09-14T12:00:00Z',
          previewBlocks: 5,
        },
        now,
      ),
    ).toEqual({ kind: 'archived', previewBlocks: 5 })
  })

  it('reports pending-save when published without freeUntil', () => {
    expect(derivePremiumStatus({ isPublished: true }, now)).toEqual({
      kind: 'pending-save',
      freeWindowHours: 72,
    })
  })

  it('treats an invalid freeUntil as pending-save', () => {
    expect(
      derivePremiumStatus({ isPublished: true, freeUntil: 'nope' }, now).kind,
    ).toBe('pending-save')
  })
})

describe('splitDuration', () => {
  it('splits into days and hours, rounding up partial hours', () => {
    expect(splitDuration(61 * 60 * 60 * 1000 + 1)).toEqual({
      days: 2,
      hours: 14,
    })
    expect(splitDuration(0)).toEqual({ days: 0, hours: 0 })
    expect(splitDuration(-5)).toEqual({ days: 0, hours: 0 })
  })
})

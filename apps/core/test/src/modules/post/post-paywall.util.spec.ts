import { describe, expect, it } from 'vitest'

import {
  applyFreeWindowOnPublish,
  isInFreeWindow,
  readPaywallMeta,
} from '~/modules/post/post-paywall.util'

const now = new Date('2026-01-01T00:00:00.000Z')
const hoursLater = (h: number) =>
  new Date(now.getTime() + h * 3_600_000).toISOString()

describe('readPaywallMeta', () => {
  it('returns {} for null, non-object and missing paywall', () => {
    expect(readPaywallMeta(null)).toEqual({})
    expect(readPaywallMeta('x')).toEqual({})
    expect(readPaywallMeta({ lang: 'zh' })).toEqual({})
    expect(readPaywallMeta({ paywall: 'bad' })).toEqual({})
  })

  it('drops malformed fields without losing valid ones', () => {
    expect(
      readPaywallMeta({
        paywall: {
          previewBlocks: 'three',
          freeWindowHours: -1,
          freeUntil: hoursLater(1),
          purchaseEnabled: false,
        },
      }),
    ).toEqual({ freeUntil: hoursLater(1), purchaseEnabled: false })
    expect(readPaywallMeta({ paywall: { freeUntil: 'soon' } })).toEqual({})
  })
})

describe('isInFreeWindow', () => {
  it('is true only while now < freeUntil', () => {
    expect(isInFreeWindow({ paywall: { freeUntil: hoursLater(1) } }, now)).toBe(
      true,
    )
    expect(
      isInFreeWindow({ paywall: { freeUntil: now.toISOString() } }, now),
    ).toBe(false)
    expect(
      isInFreeWindow({ paywall: { freeUntil: hoursLater(-1) } }, now),
    ).toBe(false)
    expect(isInFreeWindow(null, now)).toBe(false)
  })
})

describe('applyFreeWindowOnPublish', () => {
  it('defaults to 72 hours and keeps other meta', () => {
    expect(applyFreeWindowOnPublish({ lang: 'zh' }, now)).toEqual({
      lang: 'zh',
      paywall: { freeUntil: hoursLater(72) },
    })
    expect(applyFreeWindowOnPublish(null, now)).toEqual({
      paywall: { freeUntil: hoursLater(72) },
    })
  })

  it('uses freeWindowHours and keeps sibling paywall fields', () => {
    expect(
      applyFreeWindowOnPublish(
        { paywall: { freeWindowHours: 5, previewBlocks: 2 } },
        now,
      ),
    ).toEqual({
      paywall: {
        freeWindowHours: 5,
        previewBlocks: 2,
        freeUntil: hoursLater(5),
      },
    })
  })

  it('sets freeUntil to now for freeWindowHours 0', () => {
    expect(
      applyFreeWindowOnPublish({ paywall: { freeWindowHours: 0 } }, now),
    ).toEqual({ paywall: { freeWindowHours: 0, freeUntil: now.toISOString() } })
  })

  it('leaves an existing freeUntil untouched', () => {
    const meta = { paywall: { freeUntil: hoursLater(-10), freeWindowHours: 1 } }
    expect(applyFreeWindowOnPublish(meta, now)).toBe(meta)
  })
})

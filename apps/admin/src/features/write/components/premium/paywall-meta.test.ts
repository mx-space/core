import { describe, expect, it } from 'vitest'

import {
  getPaywallMeta,
  parseFreeWindowHours,
  resolvePaywallMeta,
} from './paywall-meta'

const values = {
  freeUntil: '',
  freeWindowHours: 24,
  previewBlocks: 4,
  purchaseEnabled: false,
}

describe('getPaywallMeta', () => {
  it('reads typed fields and ignores malformed ones', () => {
    expect(
      getPaywallMeta({
        paywall: {
          freeUntil: '2026-09-17T00:00:00Z',
          freeWindowHours: '24',
          previewBlocks: 2,
          purchaseEnabled: true,
        },
      }),
    ).toEqual({
      freeUntil: '2026-09-17T00:00:00Z',
      freeWindowHours: undefined,
      previewBlocks: 2,
      purchaseEnabled: true,
    })
    expect(getPaywallMeta({})).toEqual({
      freeUntil: undefined,
      freeWindowHours: undefined,
      previewBlocks: undefined,
      purchaseEnabled: undefined,
    })
  })
})

describe('resolvePaywallMeta', () => {
  it('writes all form fields when premium', () => {
    expect(resolvePaywallMeta({ other: 1 }, true, values)).toEqual({
      other: 1,
      paywall: {
        freeWindowHours: 24,
        previewBlocks: 4,
        purchaseEnabled: false,
      },
    })
  })

  it('does not write freeUntil when the form has none', () => {
    expect(resolvePaywallMeta({}, true, values).paywall).not.toHaveProperty(
      'freeUntil',
    )
  })

  it('keeps an existing freeUntil when the form has none', () => {
    const meta = { paywall: { freeUntil: '2026-09-17T00:00:00Z', extra: 'x' } }
    expect(resolvePaywallMeta(meta, true, values).paywall).toEqual({
      extra: 'x',
      freeUntil: '2026-09-17T00:00:00Z',
      freeWindowHours: 24,
      previewBlocks: 4,
      purchaseEnabled: false,
    })
  })

  it('overrides freeUntil from the form', () => {
    const meta = { paywall: { freeUntil: '2026-09-17T00:00:00Z' } }
    expect(
      resolvePaywallMeta(meta, true, {
        ...values,
        freeUntil: '2026-09-20T00:00:00Z',
      }).paywall,
    ).toMatchObject({ freeUntil: '2026-09-20T00:00:00Z' })
  })

  it('leaves meta untouched when premium is off', () => {
    const meta = { paywall: { previewBlocks: 2, freeUntil: 'x' } }
    expect(resolvePaywallMeta(meta, false, values)).toBe(meta)
  })
})

describe('parseFreeWindowHours', () => {
  it('falls back to 72 for blank or invalid input and floors valid ones', () => {
    expect(parseFreeWindowHours('')).toBe(72)
    expect(parseFreeWindowHours('abc')).toBe(72)
    expect(parseFreeWindowHours('-3')).toBe(72)
    expect(parseFreeWindowHours('0')).toBe(0)
    expect(parseFreeWindowHours('24.9')).toBe(24)
  })
})

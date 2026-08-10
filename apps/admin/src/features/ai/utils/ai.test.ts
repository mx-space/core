import { describe, expect, it } from 'vitest'

import { buildTtsRegeneratePayload, parseLangInput } from './ai'

describe('parseLangInput', () => {
  it('splits on full-width and half-width commas, trims, lowercases, dedupes, and drops empty segments', () => {
    expect(parseLangInput('zh, EN，ja , , zh')).toEqual(['zh', 'en', 'ja'])
  })

  it('preserves first-occurrence order when deduping', () => {
    expect(parseLangInput('ja, zh, en, ja, zh')).toEqual(['ja', 'zh', 'en'])
  })

  it('returns an empty array for whitespace-only input', () => {
    expect(parseLangInput('  ')).toEqual([])
  })

  it('returns an empty array for empty input', () => {
    expect(parseLangInput('')).toEqual([])
  })

  it('folds mixed case to lowercase', () => {
    expect(parseLangInput('ZH-cn, En-US')).toEqual(['zh-cn', 'en-us'])
  })

  it('returns a single value when there is no separator', () => {
    expect(parseLangInput('zh')).toEqual(['zh'])
  })
})

describe('buildTtsRegeneratePayload', () => {
  it('forces regeneration and scopes the task to the row language', () => {
    expect(buildTtsRegeneratePayload({ lang: 'zh', refId: '42' })).toEqual({
      force: true,
      langs: ['zh'],
      refId: '42',
    })
  })

  it('always sets force, so an unchanged article still re-synthesizes', () => {
    // Without this the management page's regenerate action is a no-op by
    // construction: every row it can act on already has narration.
    expect(buildTtsRegeneratePayload({ lang: 'en', refId: '7' }).force).toBe(
      true,
    )
  })
})

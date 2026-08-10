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

  it('folds a region suffix into its 2-letter primary tag, so zh-CN and zh dedupe together', () => {
    expect(parseLangInput('zh-CN, zh')).toEqual(['zh'])
  })

  it('treats underscore as a hyphen when folding a region suffix', () => {
    expect(parseLangInput('en_US, EN')).toEqual(['en'])
  })

  it('leaves a 3-letter primary tag (and any suffix) untouched', () => {
    expect(parseLangInput('FIL-PH, jam')).toEqual(['fil-ph', 'jam'])
  })

  it('folds an alias onto the code the server will store, so jp and ja are one language', () => {
    expect(parseLangInput('jp, ja')).toEqual(['ja'])
  })

  it('maps a 3-letter ISO code onto its 2-letter form', () => {
    expect(parseLangInput('eng')).toEqual(['en'])
  })

  it('folds a script or region variant the server also folds', () => {
    expect(parseLangInput('zh-Hant, pt-BR, kr')).toEqual(['zh', 'pt', 'ko'])
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

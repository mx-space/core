import { describe, expect, it } from 'vitest'

import {
  buildTtsRegeneratePayload,
  buildTtsResumePayload,
  isTtsNarrationIncomplete,
  parseLangInput,
} from './ai'

describe('parseLangInput', () => {
  it('canonicalizes to BCP 47 language-REGION tags and reports invalid tokens', () => {
    expect(parseLangInput('zh, zh-TW, jp')).toEqual({
      invalid: ['jp'],
      langs: ['zh-CN', 'zh-TW'],
    })
  })

  it('splits on full-width and half-width commas, trims, dedupes, and drops empty segments', () => {
    expect(parseLangInput('zh, EN，ja , , zh-cn').langs).toEqual([
      'zh-CN',
      'en-US',
      'ja-JP',
    ])
  })

  it('preserves first-occurrence order when deduping', () => {
    expect(parseLangInput('ja, zh, en, ja-JP, zh').langs).toEqual([
      'ja-JP',
      'zh-CN',
      'en-US',
    ])
  })

  it('returns nothing for blank input', () => {
    expect(parseLangInput('  ')).toEqual({ invalid: [], langs: [] })
    expect(parseLangInput('')).toEqual({ invalid: [], langs: [] })
  })

  it('keeps Simplified and Traditional Chinese apart', () => {
    expect(parseLangInput('zh-Hans, zh-Hant, zh_TW').langs).toEqual([
      'zh-CN',
      'zh-TW',
    ])
  })

  it('keeps an explicit region', () => {
    expect(parseLangInput('pt-PT, en-GB, fil').langs).toEqual([
      'pt-PT',
      'en-GB',
      'fil-PH',
    ])
  })

  it('reports legacy shorthands and free text as invalid', () => {
    expect(parseLangInput('cn, english, jp').invalid).toEqual([
      'cn',
      'english',
      'jp',
    ])
  })

  it('reads tw as Twi, not Taiwan', () => {
    expect(parseLangInput('tw').langs).toEqual(['ak-GH'])
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

describe('buildTtsResumePayload', () => {
  it('never sets force, so committed chunks are reused and only the rest generate', () => {
    expect(buildTtsResumePayload({ lang: 'zh', refId: '42' })).toEqual({
      force: false,
      langs: ['zh'],
      refId: '42',
    })
  })
})

describe('isTtsNarrationIncomplete', () => {
  it('treats an empty blockOrder as an interrupted, unpublished narration', () => {
    expect(isTtsNarrationIncomplete({ blockOrder: [] })).toBe(true)
  })

  it('treats a published blockOrder as complete', () => {
    expect(isTtsNarrationIncomplete({ blockOrder: ['a', 'b'] })).toBe(false)
  })
})

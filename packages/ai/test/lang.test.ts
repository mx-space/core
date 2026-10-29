import { describe, expect, it } from 'vitest'

import {
  canonicalizeLanguageTag,
  isKnownLanguageTag,
  matchLanguage,
  toScriptLevelTag,
} from '../src'

describe('canonicalizeLanguageTag', () => {
  it.each([
    ['zh', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zho', 'zh-CN'],
    ['chi', 'zh-CN'],
    ['zh-Hant', 'zh-TW'],
    ['zh-HK', 'zh-HK'],
    ['zh-Hant-HK', 'zh-HK'],
    ['zh_TW', 'zh-TW'],
    ['en', 'en-US'],
    ['EN-us', 'en-US'],
    ['eng', 'en-US'],
    ['ja', 'ja-JP'],
    ['ko', 'ko-KR'],
    ['pt', 'pt-BR'],
    ['es-419', 'es-419'],
    ['iw', 'he-IL'],
    ['in', 'id-ID'],
    ['tw', 'ak-GH'],
    [' fr-CA ', 'fr-CA'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalizeLanguageTag(input)).toBe(expected)
  })

  it.each(['jp', 'cn', 'english', '', '   ', 'zh--TW'])(
    'rejects %j',
    (input) => {
      expect(canonicalizeLanguageTag(input)).toBeUndefined()
    },
  )

  it('rejects non-strings', () => {
    expect(canonicalizeLanguageTag(undefined)).toBeUndefined()
    expect(canonicalizeLanguageTag(null)).toBeUndefined()
  })
})

describe('isKnownLanguageTag', () => {
  it('accepts tags whose language has a display name', () => {
    expect(isKnownLanguageTag('zh-TW')).toBe(true)
    expect(isKnownLanguageTag('en')).toBe(true)
  })

  it('rejects unassigned or malformed tags', () => {
    expect(isKnownLanguageTag('jp')).toBe(false)
    expect(isKnownLanguageTag('english')).toBe(false)
    expect(isKnownLanguageTag('')).toBe(false)
  })
})

describe('toScriptLevelTag', () => {
  it('collapses regions that share a script', () => {
    expect(toScriptLevelTag('en-GB')).toBe('en-US')
    expect(toScriptLevelTag('zh-HK')).toBe('zh-TW')
    expect(toScriptLevelTag('zh-SG')).toBe('zh-CN')
    expect(toScriptLevelTag('ja')).toBe('ja-JP')
  })

  it('returns undefined for invalid tags', () => {
    expect(toScriptLevelTag('jp')).toBeUndefined()
  })
})

describe('matchLanguage', () => {
  it('prefers an exact region match', () => {
    expect(matchLanguage('zh-HK', ['zh-TW', 'zh-HK'])).toBe('zh-HK')
  })

  it('matches by language and script when regions differ', () => {
    expect(matchLanguage('zh-HK', ['zh-CN', 'zh-TW'])).toBe('zh-TW')
    expect(matchLanguage('zh-SG', ['zh-CN', 'zh-TW'])).toBe('zh-CN')
    expect(matchLanguage('en-GB', ['ja-JP', 'en-US'])).toBe('en-US')
  })

  it('takes the first qualified candidate when no region matches', () => {
    expect(matchLanguage('en-GB', ['en-US', 'en-AU'])).toBe('en-US')
  })

  it('returns the candidate as canonical even when stored in a legacy form', () => {
    expect(matchLanguage('en-US', ['ja', 'en'])).toBe('en-US')
  })

  it('returns undefined when nothing qualifies', () => {
    expect(matchLanguage('zh-TW', ['zh-CN', 'en-US'])).toBeUndefined()
    expect(matchLanguage('jp', ['ja-JP'])).toBeUndefined()
    expect(matchLanguage(undefined, ['ja-JP'])).toBeUndefined()
    expect(matchLanguage('ja', [])).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'

import {
  excludeSourceLanguage,
  findRowByLanguage,
  getLanguageName,
  normalizeTargetLangs,
  parseLanguageCode,
  resolveArticleSourceLang,
  resolveGenerationLanguage,
  resolveServedLanguage,
  resolveTargetLanguages,
} from '~/modules/ai/ai-language.util'

describe('ai-language.util', () => {
  describe('resolveGenerationLanguage', () => {
    it('reuses a qualified candidate', () => {
      expect(resolveGenerationLanguage('en-GB', ['ja-JP', 'en-US'])).toBe(
        'en-US',
      )
      expect(resolveGenerationLanguage('zh-HK', ['zh-TW'])).toBe('zh-TW')
    })

    it('falls back to the script-level tag', () => {
      expect(resolveGenerationLanguage('en-GB', [])).toBe('en-US')
      expect(resolveGenerationLanguage('zh-HK', ['zh-CN'])).toBe('zh-TW')
    })

    it('returns undefined for invalid tags', () => {
      expect(resolveGenerationLanguage('jp', ['ja-JP'])).toBeUndefined()
    })
  })

  describe('excludeSourceLanguage', () => {
    it('drops targets sharing the source language and script', () => {
      expect(
        excludeSourceLanguage(['zh-SG', 'zh-TW', 'en-US'], 'zh-CN'),
      ).toEqual(['zh-TW', 'en-US'])
      expect(excludeSourceLanguage(['en-GB', 'ja-JP'], 'en')).toEqual(['ja-JP'])
    })
  })

  describe('findRowByLanguage', () => {
    it('finds the row whose language and script match', () => {
      const rows = [{ lang: 'zh-CN' }, { lang: 'zh-TW' }, { lang: 'en' }]
      expect(findRowByLanguage(rows, 'zh-HK')).toBe(rows[1])
      expect(findRowByLanguage(rows, 'en-GB')).toBe(rows[2])
      expect(findRowByLanguage(rows, 'ja-JP')).toBeUndefined()
    })

    it('reads a row without a language as the default language', () => {
      const rows = [{ lang: null }]
      expect(findRowByLanguage(rows, 'zh-SG')).toBe(rows[0])
    })
  })

  describe('resolveServedLanguage', () => {
    const configured = ['zh-TW', 'en-US']

    it('matches a configured target by language and script', () => {
      expect(resolveServedLanguage('zh-HK', configured)).toBe('zh-TW')
      expect(resolveServedLanguage('en-GB', configured)).toBe('en-US')
    })

    it('matches the default source language', () => {
      expect(resolveServedLanguage('zh-SG', configured)).toBe('zh-CN')
      expect(resolveServedLanguage('zh', configured)).toBe('zh-CN')
    })

    it('falls back to the tag on-demand generation writes when nothing qualifies', () => {
      expect(resolveServedLanguage('fr', configured)).toBe('fr-FR')
      expect(resolveServedLanguage('en-GB', undefined)).toBe('en-US')
      expect(resolveServedLanguage('zh-HK', [])).toBe('zh-TW')
    })

    it('returns undefined for invalid or missing requests', () => {
      expect(resolveServedLanguage('jp', configured)).toBeUndefined()
      expect(resolveServedLanguage(undefined, configured)).toBeUndefined()
    })
  })

  describe('parseLanguageCode', () => {
    it('keeps canonical language-region tags', () => {
      expect(parseLanguageCode('en-US')).toBe('en-US')
      expect(parseLanguageCode('zh-CN')).toBe('zh-CN')
      expect(parseLanguageCode('zh-TW')).toBe('zh-TW')
      expect(parseLanguageCode('ja-JP')).toBe('ja-JP')
    })

    it('takes the first valid tag of an Accept-Language header', () => {
      expect(parseLanguageCode('en-US,en;q=0.9,zh;q=0.8')).toBe('en-US')
      expect(parseLanguageCode('jp,zh-TW;q=0.9')).toBe('zh-TW')
    })

    it('fills the likely region for bare language codes', () => {
      expect(parseLanguageCode('en')).toBe('en-US')
      expect(parseLanguageCode('zh')).toBe('zh-CN')
      expect(parseLanguageCode('fil')).toBe('fil-PH')
      expect(parseLanguageCode('yue')).toBe('yue-HK')
    })

    it('is case and separator insensitive', () => {
      expect(parseLanguageCode('EN-us')).toBe('en-US')
      expect(parseLanguageCode('zh_tw')).toBe('zh-TW')
    })

    it('returns the default for empty, invalid, or undefined input', () => {
      expect(parseLanguageCode('')).toBe('zh-CN')
      expect(parseLanguageCode(undefined)).toBe('zh-CN')
      expect(parseLanguageCode('1234')).toBe('zh-CN')
      expect(parseLanguageCode('jp')).toBe('zh-CN')
    })
  })

  describe('normalizeTargetLangs', () => {
    it('canonicalizes, drops invalid entries and dedupes', () => {
      expect(
        normalizeTargetLangs(['zh', 'zh-TW', 'en', 'jp', 'zh-CN', ' ']),
      ).toEqual(['zh-CN', 'zh-TW', 'en-US'])
    })

    it('handles missing input', () => {
      expect(normalizeTargetLangs(undefined)).toEqual([])
      expect(normalizeTargetLangs(null)).toEqual([])
    })
  })

  describe('resolveArticleSourceLang', () => {
    it('reads a canonical meta.lang', () => {
      expect(resolveArticleSourceLang({ meta: { lang: 'zh-TW' } })).toBe(
        'zh-TW',
      )
      expect(resolveArticleSourceLang({ meta: { lang: 'en' } })).toBe('en-US')
    })

    it('falls back to the default source language', () => {
      expect(resolveArticleSourceLang({ meta: null })).toBe('zh-CN')
      expect(resolveArticleSourceLang({ meta: { lang: 'jp' } })).toBe('zh-CN')
    })
  })

  describe('getLanguageName', () => {
    it('should return the base language name for known tags', () => {
      expect(getLanguageName('en-US')).toBe('English')
      expect(getLanguageName('zh-TW')).toBe('Chinese')
      expect(getLanguageName('ja')).toBe('Japanese')
      expect(getLanguageName('ko-KR')).toBe('Korean')
    })

    it('should return code itself for unknown codes', () => {
      expect(getLanguageName('unknown')).toBe('unknown')
      expect(getLanguageName('xyz')).toBe('xyz')
    })
  })

  describe('resolveTargetLanguages', () => {
    it('should return explicit languages when provided', () => {
      expect(resolveTargetLanguages(['en', 'ja'], ['ko'])).toEqual(['en', 'ja'])
    })

    it('should fallback to configured when explicit is empty', () => {
      expect(resolveTargetLanguages([], ['ko', 'ja'])).toEqual(['ko', 'ja'])
    })

    it('should fallback to configured when explicit is undefined', () => {
      expect(resolveTargetLanguages(undefined, ['zh'])).toEqual(['zh'])
    })

    it('should return empty array when both are undefined', () => {
      expect(resolveTargetLanguages(undefined, undefined)).toEqual([])
    })

    it('should return empty array when both are empty', () => {
      expect(resolveTargetLanguages([], [])).toEqual([])
    })
  })
})

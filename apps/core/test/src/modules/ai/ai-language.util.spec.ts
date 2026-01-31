import {
  getLanguageName,
  parseLanguageCode,
  resolveTargetLanguage,
} from '~/modules/ai/ai-language.util'
import { describe, expect, it } from 'vitest'

describe('ai-language.util', () => {
  describe('parseLanguageCode', () => {
    it('should extract language code from locale', () => {
      expect(parseLanguageCode('en-US')).toBe('en')
      expect(parseLanguageCode('zh-CN')).toBe('zh')
      expect(parseLanguageCode('ja-JP')).toBe('ja')
    })

    it('should handle Accept-Language header format', () => {
      expect(parseLanguageCode('en-US,en;q=0.9,zh;q=0.8')).toBe('en')
      expect(parseLanguageCode('zh-CN,zh;q=0.9')).toBe('zh')
    })

    it('should handle simple language code', () => {
      expect(parseLanguageCode('en')).toBe('en')
      expect(parseLanguageCode('zh')).toBe('zh')
    })

    it('should return default when empty or undefined', () => {
      expect(parseLanguageCode('')).toBe('zh')
      expect(parseLanguageCode(undefined)).toBe('zh')
    })

    it('should convert to lowercase', () => {
      expect(parseLanguageCode('EN-US')).toBe('en')
      expect(parseLanguageCode('ZH-CN')).toBe('zh')
    })
  })

  describe('getLanguageName', () => {
    it('should return full language name for known codes', () => {
      expect(getLanguageName('en')).toBe('English')
      expect(getLanguageName('zh')).toBe('Chinese')
      expect(getLanguageName('ja')).toBe('Japanese')
      expect(getLanguageName('ko')).toBe('Korean')
    })

    it('should return code itself for unknown codes', () => {
      expect(getLanguageName('unknown')).toBe('unknown')
      expect(getLanguageName('xyz')).toBe('xyz')
    })
  })

  describe('resolveTargetLanguage', () => {
    it('should use configured language when not auto', () => {
      const result = resolveTargetLanguage(
        { preferredLang: 'ja', acceptLanguage: 'en-US' },
        { configuredLanguage: 'ko' },
      )
      expect(result).toBe('ko')
    })

    it('should use preferredLang in auto mode', () => {
      const result = resolveTargetLanguage(
        { preferredLang: 'ja', acceptLanguage: 'en-US' },
        { configuredLanguage: 'auto' },
      )
      expect(result).toBe('ja')
    })

    it('should use acceptLanguage when no preferredLang in auto mode', () => {
      const result = resolveTargetLanguage(
        { acceptLanguage: 'en-US' },
        { configuredLanguage: 'auto' },
      )
      expect(result).toBe('en')
    })

    it('should use default language when no user preference', () => {
      const result = resolveTargetLanguage(
        {},
        { configuredLanguage: 'auto', defaultLanguage: 'zh' },
      )
      expect(result).toBe('zh')
    })

    it('should fallback to default when no config', () => {
      const result = resolveTargetLanguage({}, {})
      expect(result).toBe('zh') // DEFAULT_SUMMARY_LANG
    })

    it('should handle undefined configuredLanguage as auto', () => {
      const result = resolveTargetLanguage(
        { preferredLang: 'fr' },
        { configuredLanguage: undefined },
      )
      expect(result).toBe('fr')
    })
  })
})

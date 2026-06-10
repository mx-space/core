import { describe, expect, it } from 'vitest'

import {
  getLanguageName,
  parseLanguageCode,
  resolveTargetLanguages,
} from '~/modules/ai/ai-language.util'

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

    it('should remap legacy aliases to canonical codes', () => {
      expect(parseLanguageCode('jp')).toBe('ja')
      expect(parseLanguageCode('cn')).toBe('zh')
      expect(parseLanguageCode('kr')).toBe('ko')
    })

    it('should pass through unknown but valid base codes', () => {
      expect(parseLanguageCode('fil')).toBe('fil')
      expect(parseLanguageCode('yue')).toBe('yue')
      expect(parseLanguageCode('FIL-PH')).toBe('fil')
    })

    it('should return default when empty, garbage, or undefined', () => {
      expect(parseLanguageCode('')).toBe('zh')
      expect(parseLanguageCode(undefined)).toBe('zh')
      expect(parseLanguageCode('1234')).toBe('zh')
      expect(parseLanguageCode('not a lang')).toBe('zh')
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

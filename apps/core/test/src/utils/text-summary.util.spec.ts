import { describe, expect, test } from 'vitest'

import { truncateAtBoundary } from '~/utils/text-summary.util'

describe('truncateAtBoundary', () => {
  describe('passthroughs', () => {
    test('returns empty string for empty/non-string input', () => {
      expect(truncateAtBoundary('', 10)).toBe('')
      expect(truncateAtBoundary(undefined as unknown as string, 10)).toBe('')
      expect(truncateAtBoundary(null as unknown as string, 10)).toBe('')
    })

    test('returns trimmed text when within budget', () => {
      expect(truncateAtBoundary('  hello world  ', 50)).toBe('hello world')
    })

    test('returns empty when maxLength <= 0', () => {
      expect(truncateAtBoundary('anything', 0)).toBe('')
    })
  })

  describe('Latin / English', () => {
    const text =
      'The quick brown fox jumps over the lazy dog. ' +
      'Then it runs into the woods. After that, things get strange.'

    test('cuts at sentence boundary, no ellipsis', () => {
      const out = truncateAtBoundary(text, 60, 'en')
      // Should land on a complete sentence — no ellipsis suffix.
      expect(out.endsWith('…')).toBe(false)
      expect(out).toBe('The quick brown fox jumps over the lazy dog.')
    })

    test('falls back to word boundary when first sentence exceeds', () => {
      const longSentence =
        'The quick brown fox jumps over the lazy dog repeatedly while the rain pours and never stops at all'
      const out = truncateAtBoundary(longSentence, 30, 'en')
      // Cuts at last word boundary within budget.
      expect(out.endsWith('…')).toBe(true)
      // Penultimate char should be a letter (no mid-word break).
      const beforeEllipsis = out.slice(0, -1)
      expect(/[a-z]$/i.test(beforeEllipsis)).toBe(true)
      // Length budget respected.
      expect(out.length).toBeLessThanOrEqual(30)
    })
  })

  describe('Chinese / CJK', () => {
    const text = '今日天气甚佳，吾往山中观枫。落叶满径，意境绝伦。归来时已暮。'

    test('cuts at full-stop punctuation, no ellipsis', () => {
      // 14-char first sentence: 今日天气甚佳，吾往山中观枫。
      const out = truncateAtBoundary(text, 14, 'zh')
      expect(out.endsWith('…')).toBe(false)
      expect(out.endsWith('。')).toBe(true)
    })

    test('respects budget across multiple sentences', () => {
      const out = truncateAtBoundary(text, 30, 'zh')
      expect(out.length).toBeLessThanOrEqual(30)
      expect(out.endsWith('。')).toBe(true)
    })

    test('character-cut fallback when first segment alone exceeds', () => {
      // Sentence with no punctuation at all — sentence segmenter returns
      // one segment that exceeds the budget, so the helper has to fall
      // back to a word/char cut.
      const noPunct = '今日天气甚佳吾往山中观枫落叶满径意境绝伦归来时已暮'
      const out = truncateAtBoundary(noPunct, 8, 'zh')
      expect(out.length).toBeLessThanOrEqual(8)
      expect(out.endsWith('…')).toBe(true)
    })
  })

  describe('mixed scripts', () => {
    test('English + Chinese — picks the boundary closest to budget', () => {
      const text =
        'Hello world. 这是一个测试。This sentence is in English again.'
      const out = truncateAtBoundary(text, 20, 'en')
      expect(out.length).toBeLessThanOrEqual(20)
      // At least one complete sentence fits — the result should end on
      // either an English period or a CJK full stop, never mid-word.
      expect(/[.。]$/.test(out)).toBe(true)
    })
  })
})

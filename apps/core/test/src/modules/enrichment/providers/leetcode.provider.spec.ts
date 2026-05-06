import { describe, expect, it } from 'vitest'

import { LeetcodeProvider } from '~/modules/enrichment/providers/leetcode/leetcode.provider'

describe('LeetcodeProvider', () => {
  const provider = new LeetcodeProvider()

  describe('matchUrl', () => {
    it('matches leetcode.com/problems/two-sum/', () => {
      const result = provider.matchUrl(
        new URL('https://leetcode.com/problems/two-sum/'),
      )
      expect(result).toEqual({
        id: 'two-sum',
        fullUrl: 'https://leetcode.com/problems/two-sum/',
        subtype: 'problem',
      })
    })

    it('matches leetcode.cn/problems/two-sum/', () => {
      const result = provider.matchUrl(
        new URL('https://leetcode.cn/problems/two-sum/'),
      )
      expect(result?.id).toBe('two-sum')
    })

    it('rejects leetcode.com/contest/ paths', () => {
      expect(
        provider.matchUrl(new URL('https://leetcode.com/contest/weekly/')),
      ).toBeNull()
    })

    it('rejects non-leetcode domains', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/problems/two-sum/')),
      ).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts kebab-case slugs', () => {
      expect(provider.isValidId('two-sum')).toBe(true)
    })
    it('accepts complex slugs', () => {
      expect(provider.isValidId('median-of-two-sorted-arrays')).toBe(true)
    })
    it('rejects uppercase', () => {
      expect(provider.isValidId('Two-Sum')).toBe(false)
    })
    it('rejects empty', () => {
      expect(provider.isValidId('')).toBe(false)
    })
  })
})

import { describe, expect, it } from 'vitest'

import { ArxivProvider } from '~/modules/enrichment/providers/arxiv/arxiv.provider'

describe('ArxivProvider', () => {
  const provider = new ArxivProvider()

  describe('matchUrl', () => {
    it('matches arxiv.org/abs/2301.01234', () => {
      const result = provider.matchUrl(new URL('https://arxiv.org/abs/2301.01234'))
      expect(result).toEqual({
        id: '2301.01234',
        fullUrl: 'https://arxiv.org/abs/2301.01234',
        subtype: 'paper',
      })
    })

    it('matches arxiv.org/abs/2301.01234v2 (versioned)', () => {
      const result = provider.matchUrl(new URL('https://arxiv.org/abs/2301.01234v2'))
      expect(result?.id).toBe('2301.01234v2')
    })

    it('matches arxiv.org/pdf/ and normalizes to /abs/', () => {
      const result = provider.matchUrl(new URL('https://arxiv.org/pdf/2301.01234'))
      expect(result?.id).toBe('2301.01234')
      expect(result?.fullUrl).toBe('https://arxiv.org/abs/2301.01234')
    })

    it('rejects arxiv.org/list/ paths', () => {
      expect(provider.matchUrl(new URL('https://arxiv.org/list/cs.AI'))).toBeNull()
    })

    it('rejects non-arxiv.org domains', () => {
      expect(provider.matchUrl(new URL('https://example.com/abs/2301.01234'))).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts valid arxiv ids', () => {
      expect(provider.isValidId('2301.01234')).toBe(true)
    })
    it('accepts versioned ids', () => {
      expect(provider.isValidId('2301.01234v2')).toBe(true)
    })
    it('rejects non-matching ids', () => {
      expect(provider.isValidId('abc')).toBe(false)
    })
  })
})

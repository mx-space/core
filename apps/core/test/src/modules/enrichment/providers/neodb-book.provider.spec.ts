import { describe, expect, it } from 'vitest'

import { NeoDBBookProvider } from '~/modules/enrichment/providers/neodb/neodb-book.provider'

describe('NeoDBBookProvider', () => {
  const provider = new NeoDBBookProvider()

  describe('matchUrl', () => {
    it('matches book.douban.com/subject/1234567', () => {
      const result = provider.matchUrl(
        new URL('https://book.douban.com/subject/1234567/'),
      )
      expect(result).toEqual({
        id: 'douban-book:1234567',
        fullUrl: 'https://book.douban.com/subject/1234567/',
        subtype: 'book',
      })
    })

    it('matches neodb.social/item/abc123', () => {
      const result = provider.matchUrl(
        new URL('https://neodb.social/item/abc123'),
      )
      expect(result?.id).toBe('item/abc123')
    })

    it('rejects book.douban.com/tag/ paths', () => {
      expect(
        provider.matchUrl(new URL('https://book.douban.com/tag/fiction')),
      ).toBeNull()
    })

    it('rejects non-matching domains', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/subject/123')),
      ).toBeNull()
    })
  })
})

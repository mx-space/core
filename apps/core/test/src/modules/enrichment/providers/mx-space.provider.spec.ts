import { describe, expect, it } from 'vitest'

import { MxSpaceProvider } from '~/modules/enrichment/providers/self/mx-space.provider'

describe('MxSpaceProvider', () => {
  const provider = new MxSpaceProvider(null as any)

  describe('matchUrl', () => {
    it('matches /posts/slug-here', () => {
      const result = provider.matchUrl(new URL('https://example.com/posts/my-post'))
      expect(result).toEqual({
        id: 'post:my-post',
        fullUrl: 'https://example.com/posts/my-post',
        subtype: 'post',
      })
    })

    it('matches /notes/42', () => {
      const result = provider.matchUrl(new URL('https://example.com/notes/42'))
      expect(result).toEqual({
        id: 'note:42',
        fullUrl: 'https://example.com/notes/42',
        subtype: 'note',
      })
    })

    it('rejects /notes/abc (non-numeric)', () => {
      expect(provider.matchUrl(new URL('https://example.com/notes/abc'))).toBeNull()
    })

    it('rejects /pages/about', () => {
      expect(provider.matchUrl(new URL('https://example.com/pages/about'))).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts post:slug', () => {
      expect(provider.isValidId('post:my-slug')).toBe(true)
    })
    it('accepts note:number', () => {
      expect(provider.isValidId('note:42')).toBe(true)
    })
    it('rejects unknown prefix', () => {
      expect(provider.isValidId('unknown:123')).toBe(false)
    })
  })
})

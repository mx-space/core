import { beforeEach, describe, expect, it } from 'vitest'

import { MxSpaceProvider } from '~/modules/enrichment/providers/self/mx-space.provider'

describe('MxSpaceProvider', () => {
  let provider: MxSpaceProvider

  beforeEach(() => {
    provider = new MxSpaceProvider(
      null as any,
      null as any,
      null as any,
      null as any,
    )
    // matchUrl checks `siteHost` in non-dev mode (vitest sets NODE_ENV=test).
    // Skip the async configsService bootstrap and pin the host directly.
    ;(provider as any).siteHost = 'example.com'
  })

  describe('matchUrl', () => {
    it('matches /posts/<category>/<slug>', () => {
      const result = provider.matchUrl(
        new URL('https://example.com/posts/tech/my-post'),
      )
      expect(result).toEqual({
        id: 'post:tech/my-post',
        fullUrl: 'https://example.com/posts/tech/my-post',
        subtype: 'post',
      })
    })

    it('matches /notes/<nid>', () => {
      const result = provider.matchUrl(new URL('https://example.com/notes/42'))
      expect(result).toEqual({
        id: 'note:42',
        fullUrl: 'https://example.com/notes/42',
        subtype: 'note',
      })
    })

    it('matches /notes/<year>/<month>/<day>/<slug>', () => {
      const result = provider.matchUrl(
        new URL('https://example.com/notes/2026/5/5/hello'),
      )
      expect(result).toEqual({
        id: 'note-date:2026/5/5/hello',
        fullUrl: 'https://example.com/notes/2026/5/5/hello',
        subtype: 'note',
      })
    })

    it('rejects /notes/abc (non-numeric, non-date)', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/notes/abc')),
      ).toBeNull()
    })

    it('rejects /pages/about', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/pages/about')),
      ).toBeNull()
    })

    it('rejects URL whose hostname does not match the configured site', () => {
      expect(
        provider.matchUrl(new URL('https://other.com/posts/tech/my-post')),
      ).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts post:<cat>/<slug>', () => {
      expect(provider.isValidId('post:tech/my-slug')).toBe(true)
    })
    it('accepts note:<nid>', () => {
      expect(provider.isValidId('note:42')).toBe(true)
    })
    it('accepts note-date:<y>/<m>/<d>/<slug>', () => {
      expect(provider.isValidId('note-date:2026/5/5/hello')).toBe(true)
    })
    it('rejects unknown prefix', () => {
      expect(provider.isValidId('unknown:123')).toBe(false)
    })
  })
})

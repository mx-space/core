import { describe, expect, it } from 'vitest'

import { BangumiProvider } from '~/modules/enrichment/providers/bangumi/bangumi.provider'

describe('BangumiProvider', () => {
  const provider = new BangumiProvider()

  describe('matchUrl', () => {
    it('matches bgm.tv/subject/12345', () => {
      const result = provider.matchUrl(new URL('https://bgm.tv/subject/12345'))
      expect(result).toEqual({
        id: '12345',
        fullUrl: 'https://bgm.tv/subject/12345',
        subtype: 'subject',
      })
    })

    it('matches bangumi.tv/subject/12345', () => {
      const result = provider.matchUrl(new URL('https://bangumi.tv/subject/12345'))
      expect(result).not.toBeNull()
      expect(result?.id).toBe('12345')
    })

    it('rejects /user/ paths', () => {
      expect(provider.matchUrl(new URL('https://bgm.tv/user/123'))).toBeNull()
    })

    it('rejects non-bgm domains', () => {
      expect(provider.matchUrl(new URL('https://example.com/subject/123'))).toBeNull()
    })

    it('rejects /subject without id', () => {
      expect(provider.matchUrl(new URL('https://bgm.tv/subject'))).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts numeric ids', () => {
      expect(new BangumiProvider().isValidId('12345')).toBe(true)
    })
    it('rejects non-numeric', () => {
      expect(new BangumiProvider().isValidId('abc')).toBe(false)
    })
  })
})

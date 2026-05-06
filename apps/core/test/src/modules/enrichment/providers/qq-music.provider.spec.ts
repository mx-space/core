import { describe, expect, it } from 'vitest'

import { QQMusicProvider } from '~/modules/enrichment/providers/qq/qq-music.provider'

describe('QQMusicProvider', () => {
  const provider = new QQMusicProvider()

  describe('matchUrl', () => {
    it('matches y.qq.com/n/ryqq/songDetail/001abc', () => {
      const result = provider.matchUrl(
        new URL('https://y.qq.com/n/ryqq/songDetail/001abc'),
      )
      expect(result).toEqual({
        id: '001abc',
        fullUrl: 'https://y.qq.com/n/ryqq/songDetail/001abc',
        subtype: 'song',
      })
    })

    it('rejects y.qq.com without songDetail', () => {
      expect(
        provider.matchUrl(new URL('https://y.qq.com/n/ryqq/albumDetail/123')),
      ).toBeNull()
    })

    it('rejects non-y.qq.com domains', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/songDetail/001abc')),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    it('returns static link card', async () => {
      const result = await provider.fetch('001abc')
      expect(result.title).toBe('QQ Music: 001abc')
      expect(result.url).toBe('https://y.qq.com/n/ryqq/songDetail/001abc')
      expect(result.subtype).toBe('song')
    })
  })
})

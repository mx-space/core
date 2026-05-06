import { describe, expect, it } from 'vitest'

import { NeteaseMusicProvider } from '~/modules/enrichment/providers/netease/netease-music.provider'

describe('NeteaseMusicProvider', () => {
  const provider = new NeteaseMusicProvider()

  describe('matchUrl', () => {
    it('matches music.163.com/song?id=12345', () => {
      const result = provider.matchUrl(
        new URL('https://music.163.com/song?id=12345'),
      )
      expect(result).toEqual({
        id: '12345',
        fullUrl: 'https://music.163.com/song?id=12345',
        subtype: 'song',
      })
    })

    it('rejects music.163.com/song without id param', () => {
      expect(
        provider.matchUrl(new URL('https://music.163.com/song')),
      ).toBeNull()
    })

    it('rejects non-music.163.com domains', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/song?id=12345')),
      ).toBeNull()
    })
  })

  describe('isValidId', () => {
    it('accepts numeric ids', () => {
      expect(provider.isValidId('12345')).toBe(true)
    })
    it('rejects non-numeric', () => {
      expect(provider.isValidId('abc')).toBe(false)
    })
  })
})

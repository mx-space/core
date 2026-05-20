import { describe, expect, it, vi } from 'vitest'

import type { TMDBMovieApiResponse } from '~/modules/enrichment/providers/api-response.types'
import type { TmdbClient } from '~/modules/enrichment/providers/tmdb/tmdb.client'
import { TmdbProvider } from '~/modules/enrichment/providers/tmdb/tmdb.provider'

const createClient = () =>
  ({ fetch: vi.fn(), getApiKey: vi.fn() }) as unknown as TmdbClient

describe('TmdbProvider', () => {
  const provider = new TmdbProvider(createClient())

  describe('matchUrl', () => {
    it('matches themoviedb.org/movie/123-slug', () => {
      const result = provider.matchUrl(
        new URL('https://www.themoviedb.org/movie/12345-inception'),
      )
      expect(result).toEqual({
        id: 'movie/12345',
        fullUrl: 'https://www.themoviedb.org/movie/12345-inception',
        subtype: 'movie',
      })
    })

    it('matches themoviedb.org/tv/123-slug', () => {
      const result = provider.matchUrl(
        new URL('https://www.themoviedb.org/tv/67890-breaking-bad'),
      )
      expect(result?.subtype).toBe('tv')
      expect(result?.id).toBe('tv/67890')
    })

    it('rejects non-tmdb domains', () => {
      expect(
        provider.matchUrl(new URL('https://example.com/movie/123')),
      ).toBeNull()
    })

    it('rejects /person/ paths', () => {
      expect(
        provider.matchUrl(new URL('https://www.themoviedb.org/person/123')),
      ).toBeNull()
    })

    it('rejects non-numeric id in slug', () => {
      expect(
        provider.matchUrl(new URL('https://www.themoviedb.org/movie/abc')),
      ).toBeNull()
    })
  })

  describe('fetch', () => {
    const baseData: TMDBMovieApiResponse = {
      id: 550,
      title: 'Fight Club',
      overview: 'A great movie',
      poster_path: '/poster.jpg',
      vote_average: 8.4,
      vote_count: 25000,
      genres: [{ name: 'Drama' }, { name: 'Thriller' }],
      release_date: '1999-10-15',
    }

    it('normalizes movie response', async () => {
      const client = createClient()
      vi.mocked(client.fetch).mockResolvedValue(baseData)
      const p = new TmdbProvider(client)

      const result = await p.fetch('movie/550')

      expect(result.title).toBe('Fight Club')
      expect(result.subtype).toBe('movie')
      expect(result.thumbnailImage?.url).toBe(
        'https://image.tmdb.org/t/p/w500/poster.jpg',
      )
      expect(result.publishedAt).toBe('1999-10-15')
      expect(result.attributes).toContainEqual({
        key: 'rating',
        value: 8.4,
        label: 'Rating',
        format: 'rating',
      })
      expect(result.attributes).toContainEqual({
        key: 'genres',
        value: 'Drama, Thriller',
        label: 'Genres',
        format: 'text',
      })
    })

    it('passes language=zh-CN when locale=zh', async () => {
      const client = createClient()
      vi.mocked(client.fetch).mockResolvedValue(baseData)
      const p = new TmdbProvider(client)

      await p.fetch('movie/550', 'zh')

      expect(client.fetch).toHaveBeenCalledWith('/3/movie/550', {
        language: 'zh-CN',
      })
    })

    it('passes no language when locale is undefined', async () => {
      const client = createClient()
      vi.mocked(client.fetch).mockResolvedValue(baseData)
      const p = new TmdbProvider(client)

      await p.fetch('movie/550')

      expect(client.fetch).toHaveBeenCalledWith('/3/movie/550', undefined)
    })

    it('skips backfill when primary fields are populated', async () => {
      const client = createClient()
      vi.mocked(client.fetch).mockResolvedValue(baseData)
      const p = new TmdbProvider(client)

      await p.fetch('movie/550', 'zh')

      expect(client.fetch).toHaveBeenCalledTimes(1)
    })

    it('falls back to en-US when zh overview is empty', async () => {
      const client = createClient()
      const sparse: TMDBMovieApiResponse = {
        ...baseData,
        title: '搏击俱乐部',
        overview: '',
      }
      const enFallback: TMDBMovieApiResponse = {
        ...baseData,
        title: 'Fight Club',
        overview: 'A great movie',
      }
      vi.mocked(client.fetch)
        .mockResolvedValueOnce(sparse) // primary zh
        .mockResolvedValueOnce(enFallback) // backfill en
      const p = new TmdbProvider(client)

      const result = await p.fetch('movie/550', 'zh')

      expect(client.fetch).toHaveBeenCalledTimes(2)
      expect(client.fetch).toHaveBeenNthCalledWith(2, '/3/movie/550', {
        language: 'en-US',
      })
      expect(result.title).toBe('搏击俱乐部')
      expect(result.description).toBe('A great movie')
    })

    it('does NOT backfill when locale is en (already en)', async () => {
      const client = createClient()
      const sparse: TMDBMovieApiResponse = {
        ...baseData,
        overview: '',
      }
      vi.mocked(client.fetch).mockResolvedValue(sparse)
      const p = new TmdbProvider(client)

      await p.fetch('movie/550', 'en')

      expect(client.fetch).toHaveBeenCalledTimes(1)
      expect(client.fetch).toHaveBeenCalledWith('/3/movie/550', {
        language: 'en-US',
      })
    })

    it('returns primary result even when backfill fetch throws', async () => {
      const client = createClient()
      const sparse: TMDBMovieApiResponse = {
        ...baseData,
        overview: '',
      }
      vi.mocked(client.fetch)
        .mockResolvedValueOnce(sparse)
        .mockRejectedValueOnce(new Error('backfill 503'))
      const p = new TmdbProvider(client)

      const result = await p.fetch('movie/550', 'zh')

      expect(result.title).toBe('Fight Club')
      expect(result.description).toBeUndefined() // empty, no backfill
    })
  })
})

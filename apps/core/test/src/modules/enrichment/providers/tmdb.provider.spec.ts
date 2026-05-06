import { describe, expect, it } from 'vitest'

import type { TMDBMovieApiResponse } from '~/modules/enrichment/providers/api-response.types'
import { TmdbProvider } from '~/modules/enrichment/providers/tmdb/tmdb.provider'
import type { TmdbClient } from '~/modules/enrichment/providers/tmdb/tmdb.client'

import { vi } from 'vitest'

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
    it('normalizes movie response', async () => {
      const client = createClient()
      const mockData: TMDBMovieApiResponse = {
        id: 550,
        title: 'Fight Club',
        overview: 'A great movie',
        poster_path: '/poster.jpg',
        vote_average: 8.4,
        vote_count: 25000,
        genres: [{ name: 'Drama' }, { name: 'Thriller' }],
        release_date: '1999-10-15',
      }
      vi.mocked(client.fetch).mockResolvedValue(mockData)
      const p = new TmdbProvider(client)

      const result = await p.fetch('movie/550')

      expect(result.title).toBe('Fight Club')
      expect(result.subtype).toBe('movie')
      expect(result.image?.url).toBe('https://image.tmdb.org/t/p/w500/poster.jpg')
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
  })
})

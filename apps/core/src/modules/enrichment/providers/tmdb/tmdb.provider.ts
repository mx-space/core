import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import type { TMDBMovieApiResponse } from '../api-response.types'
import { TmdbClient } from './tmdb.client'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

@Injectable()
export class TmdbProvider implements EnrichmentProvider {
  readonly name = 'tmdb'
  readonly displayName = 'TMDB'
  readonly category = ENRICHMENT_CATEGORIES.MEDIA
  readonly priority = 10
  readonly defaultTtl = 86400

  constructor(private readonly client: TmdbClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'www.themoviedb.org' && url.hostname !== 'themoviedb.org') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const [type, slug] = parts
    if (type !== 'movie' && type !== 'tv') return null
    const id = slug.split('-')[0]
    if (!/^\d+$/.test(id)) return null
    return { id: `${type}/${id}`, fullUrl: url.href, subtype: type === 'movie' ? 'movie' : 'tv' }
  }

  isValidId(id: string): boolean {
    return /^(movie|tv)\/\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const data = await this.client.fetch<TMDBMovieApiResponse>(`/3/${id}`)
    const subtype = id.startsWith('movie/') ? 'movie' : 'tv'
    const attrs: NonNullable<EnrichmentResult['attributes']> = []

    if (data.vote_average != null) attrs.push({ key: 'rating', value: data.vote_average, label: 'Rating', format: 'rating' })
    if (data.vote_count != null) attrs.push({ key: 'votes', value: data.vote_count, label: 'Votes', format: 'number' })
    if (data.genres?.length) attrs.push({ key: 'genres', value: data.genres.map((g: any) => g.name).join(', '), label: 'Genres', format: 'text' })

    return {
      title: data.title || data.name || id,
      description: data.overview || undefined,
      image: data.poster_path ? { url: `${TMDB_IMAGE_BASE}${data.poster_path}`, alt: data.title || data.name } : undefined,
      url: `https://www.themoviedb.org/${subtype}/${data.id}`,
      category: this.category,
      subtype,
      publishedAt: data.release_date || data.first_air_date || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

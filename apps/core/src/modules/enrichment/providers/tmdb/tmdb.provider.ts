import { Injectable, Logger } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import type { TMDBMovieApiResponse } from '../api-response.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import { TmdbClient } from './tmdb.client'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

const TMDB_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  en: 'en-US',
}

const isBlank = (s?: string | null): boolean => !s || !s.trim()
const pickNonBlank = (
  ...vals: (string | null | undefined)[]
): string | undefined => vals.find((v) => v && v.trim()) ?? undefined

@Injectable()
export class TmdbProvider implements EnrichmentProvider {
  private readonly logger = new Logger(TmdbProvider.name)

  readonly name = 'tmdb'
  readonly displayName = 'TMDB'
  readonly category = ENRICHMENT_CATEGORIES.MEDIA
  readonly priority = 10
  readonly defaultTtl = 86400
  readonly featureGateConfigKey = 'tmdb'
  readonly requiredConfigKeys = ['apiKey']
  readonly localeAware = true
  readonly supportedLocales = ['zh', 'ja', 'ko', 'en'] as const

  constructor(private readonly client: TmdbClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (
      url.hostname !== 'www.themoviedb.org' &&
      url.hostname !== 'themoviedb.org'
    )
      return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const [type, slug] = parts
    if (type !== 'movie' && type !== 'tv') return null
    const id = slug.split('-')[0]
    if (!/^\d+$/.test(id)) return null
    return {
      id: `${type}/${id}`,
      fullUrl: url.href,
      subtype: type === 'movie' ? 'movie' : 'tv',
    }
  }

  isValidId(id: string): boolean {
    return /^(?:movie|tv)\/\d+$/.test(id)
  }

  async fetch(id: string, locale?: string): Promise<EnrichmentResult> {
    const language = locale ? TMDB_LANG_MAP[locale] : undefined
    const data = await this.client.fetch<TMDBMovieApiResponse>(
      `/3/${id}`,
      language ? { language } : undefined,
    )
    const subtype = id.startsWith('movie/') ? 'movie' : 'tv'

    // TMDB returns empty `overview` (and occasionally falls back `title`/`name`
    // to the original language) when the requested locale has no translation.
    // For non-en requests we fetch the en-US payload as a backfill source.
    let backfill: TMDBMovieApiResponse | undefined
    const needsBackfill =
      !!language &&
      language !== 'en-US' &&
      (isBlank(data.title || data.name) || isBlank(data.overview))
    if (needsBackfill) {
      try {
        backfill = await this.client.fetch<TMDBMovieApiResponse>(`/3/${id}`, {
          language: 'en-US',
        })
      } catch (error) {
        this.logger.warn(
          `TMDB en-US backfill failed for ${id}: ${(error as Error).message}`,
        )
      }
    }

    const title =
      pickNonBlank(data.title, data.name, backfill?.title, backfill?.name) || id
    const description = pickNonBlank(data.overview, backfill?.overview)

    const attrs: NonNullable<EnrichmentResult['attributes']> = []

    if (data.vote_average != null)
      attrs.push({
        key: 'rating',
        value: data.vote_average,
        label: 'Rating',
        format: 'rating',
      })
    if (data.vote_count != null)
      attrs.push({
        key: 'votes',
        value: data.vote_count,
        label: 'Votes',
        format: 'number',
      })
    if (data.genres?.length)
      attrs.push({
        key: 'genres',
        value: data.genres.map((g: any) => g.name).join(', '),
        label: 'Genres',
        format: 'text',
      })

    return {
      title,
      description,
      thumbnailImage: data.poster_path
        ? {
            url: `${TMDB_IMAGE_BASE}${data.poster_path}`,
            alt: title,
          }
        : undefined,
      url: `https://www.themoviedb.org/${subtype}/${data.id}`,
      category: this.category,
      subtype,
      publishedAt: data.release_date || data.first_air_date || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

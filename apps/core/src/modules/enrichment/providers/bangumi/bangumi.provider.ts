import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import type { BangumiSubjectApiResponse } from '../api-response.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

@Injectable()
export class BangumiProvider implements EnrichmentProvider {
  readonly name = 'bangumi'
  readonly displayName = 'Bangumi'
  readonly category = ENRICHMENT_CATEGORIES.MEDIA
  readonly priority = 10
  readonly defaultTtl = 86400
  // Public Bangumi API requires no token; only honor the `enabled` flag.
  readonly featureGateConfigKey = 'bangumi'

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'bgm.tv' && url.hostname !== 'bangumi.tv') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2 || parts[0] !== 'subject') return null
    return { id: parts[1], fullUrl: url.href, subtype: 'subject' }
  }

  isValidId(id: string): boolean {
    return /^\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const res = await fetch(`https://api.bgm.tv/v0/subjects/${id}`, {
      headers: { 'User-Agent': 'mx-space/enrichment' },
    })
    if (!res.ok) throw new Error(`Bangumi API ${res.status}`)
    const data: BangumiSubjectApiResponse = await res.json()
    const attrs: NonNullable<EnrichmentResult['attributes']> = []
    if (data.rating?.score != null)
      attrs.push({
        key: 'rating',
        value: data.rating.score,
        label: 'Rating',
        format: 'rating',
      })
    if (data.rating?.total != null)
      attrs.push({
        key: 'votes',
        value: data.rating.total,
        label: 'Votes',
        format: 'number',
      })

    return {
      title: data.name || data.name_cn || id,
      description: (data.summary || '').slice(0, 500) || undefined,
      thumbnailImage: data.images?.large
        ? { url: data.images.large, alt: data.name }
        : undefined,
      url: `https://bgm.tv/subject/${id}`,
      category: this.category,
      subtype: 'subject',
      publishedAt: data.date || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

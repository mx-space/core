import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import type { NeoDBBookApiResponse } from '../api-response.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

@Injectable()
export class NeoDBBookProvider implements EnrichmentProvider {
  readonly name = 'neodb-book'
  readonly displayName = 'NeoDB Book'
  readonly category = ENRICHMENT_CATEGORIES.BOOK
  readonly priority = 10
  readonly defaultTtl = 86400
  readonly featureGateConfigKey = 'neodb'

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname === 'book.douban.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] !== 'subject') return null
      return {
        id: `douban-book:${parts[1]}`,
        fullUrl: url.href,
        subtype: 'book',
      }
    }
    if (url.hostname === 'neodb.social') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length < 2) return null
      return {
        id: `${parts[0]}/${parts[1]}`,
        fullUrl: url.href,
        subtype: 'book',
      }
    }
    return null
  }

  isValidId(id: string): boolean {
    return id.length > 0
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const res = await fetch(`https://neodb.social/api/${id}`)
    if (!res.ok) throw new Error(`NeoDB API ${res.status}`)
    const data: NeoDBBookApiResponse = await res.json()
    const attrs: NonNullable<EnrichmentResult['attributes']> = []
    if (data.rating?.value != null)
      attrs.push({
        key: 'rating',
        value: data.rating.value,
        label: 'Rating',
        format: 'rating',
      })
    if (data.isbn)
      attrs.push({
        key: 'isbn',
        value: data.isbn,
        label: 'ISBN',
        format: 'text',
      })
    if (data.author)
      attrs.push({
        key: 'author',
        value: data.author,
        label: 'Author',
        format: 'text',
      })

    return {
      title: data.title || id,
      description: data.description || undefined,
      image: data.cover_image_url
        ? { url: data.cover_image_url, alt: data.title }
        : undefined,
      url: data.url || `https://neodb.social/${id}`,
      category: this.category,
      subtype: 'book',
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

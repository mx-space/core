import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

@Injectable()
export class QQMusicProvider implements EnrichmentProvider {
  readonly name = 'qq-music'
  readonly displayName = 'QQ Music'
  readonly category = ENRICHMENT_CATEGORIES.MUSIC
  readonly priority = 9
  readonly defaultTtl = 86400
  readonly featureGateConfigKey = 'qqMusic'

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'y.qq.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    const songIdx = parts.indexOf('songDetail')
    if (songIdx === -1 || songIdx + 1 >= parts.length) return null
    return { id: parts[songIdx + 1], fullUrl: url.href, subtype: 'song' }
  }

  isValidId(id: string): boolean {
    return id.length > 0
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    return {
      title: `QQ Music: ${id}`,
      description: 'QQ Music song',
      url: `https://y.qq.com/n/ryqq/songDetail/${id}`,
      category: this.category,
      subtype: 'song',
      fetchedAt: '',
      attributes: [],
    }
  }
}

import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'

@Injectable()
export class ArxivProvider implements EnrichmentProvider {
  readonly name = 'arxiv'
  readonly displayName = 'Arxiv'
  readonly category = ENRICHMENT_CATEGORIES.ACADEMIC
  readonly priority = 10
  readonly defaultTtl = 86400 * 7
  readonly featureGateConfigKey = 'arxiv'

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'arxiv.org') return null
    const match = url.pathname.match(/^\/(abs|pdf)\/([\d.]+(?:v\d+)?)/)
    if (!match) return null
    return {
      id: match[2],
      fullUrl: `https://arxiv.org/abs/${match[2]}`,
      subtype: 'paper',
    }
  }

  isValidId(id: string): boolean {
    return /^[\d.]+(?:v\d+)?$/.test(id)
  }

  private stripHtml(html: string): string {
    // Also matches unclosed tags (e.g. "<script" without ">")
    return html.replaceAll(/<[^>]*(>|$)/g, '')
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const res = await fetch(`https://export.arxiv.org/api/query?id_list=${id}`)
    if (!res.ok) throw new Error(`Arxiv API ${res.status}`)
    const text = await res.text()
    const titleMatch = text.match(/<title>(.*?)<\/title>/s)
    const title = this.stripHtml(titleMatch?.[1] || '').trim() || id
    const summaryMatch = text.match(/<summary>(.*?)<\/summary>/s)
    const description =
      this.stripHtml(summaryMatch?.[1] || '')
        .replaceAll(/\s+/g, ' ')
        .trim() || undefined

    return {
      title,
      description,
      url: `https://arxiv.org/abs/${id}`,
      category: this.category,
      subtype: 'paper',
      fetchedAt: '',
      attributes: [],
    }
  }
}

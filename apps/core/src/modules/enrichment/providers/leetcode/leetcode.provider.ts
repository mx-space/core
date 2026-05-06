import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import type { LeetCodeGraphQLApiResponse } from '../api-response.types'

@Injectable()
export class LeetcodeProvider implements EnrichmentProvider {
  readonly name = 'leetcode'
  readonly displayName = 'LeetCode'
  readonly category = ENRICHMENT_CATEGORIES.CODE
  readonly priority = 10
  readonly defaultTtl = 86400 * 30

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'leetcode.com' && url.hostname !== 'leetcode.cn') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2 || parts[0] !== 'problems') return null
    return { id: parts[1], fullUrl: url.href, subtype: 'problem' }
  }

  isValidId(id: string): boolean { return /^[a-z0-9-]+$/.test(id) }

  private stripHtml(html: string): string {
    // Also matches unclosed tags (e.g. "<script" without ">")
    return html.replace(/<[^>]*(>|$)/g, '')
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const query = `query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { title titleSlug content difficulty topicTags { name } stats { totalAccepted totalSubmission } } }`
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { titleSlug: id } }),
    })
    if (!res.ok) throw new Error(`LeetCode API ${res.status}`)
    const { data }: LeetCodeGraphQLApiResponse = await res.json()
    if (!data?.question) throw new Error(`LeetCode problem not found: ${id}`)
    const q = data.question
    const attrs: NonNullable<EnrichmentResult['attributes']> = []
    if (q.difficulty) attrs.push({ key: 'difficulty', value: q.difficulty, label: 'Difficulty', format: 'text' })
    if (q.stats?.totalAccepted) attrs.push({ key: 'acceptance', value: Math.round((q.stats.totalAccepted / q.stats.totalSubmission) * 100), label: 'Acceptance', format: 'percent' })
    if (q.topicTags?.length) attrs.push({ key: 'tags', value: q.topicTags.map((t: any) => t.name).join(', '), label: 'Tags', format: 'text' })

    return {
      title: q.title || id,
      description: this.stripHtml(q.content || '').slice(0, 300) || undefined,
      url: `https://leetcode.com/problems/${q.titleSlug || id}/`,
      category: this.category, subtype: 'problem',
      fetchedAt: '', attributes: attrs,
    }
  }
}

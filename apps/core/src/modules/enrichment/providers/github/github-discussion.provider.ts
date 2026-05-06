import { Injectable } from '@nestjs/common'

import type {
  EnrichmentResult,
  UrlMatchResult,
} from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import type { GitHubDiscussionSearchApiResponse } from '../api-response.types'
import { GitHubClient } from './github.client'

@Injectable()
export class GitHubDiscussionProvider implements EnrichmentProvider {
  readonly name = 'gh-discussion'
  readonly displayName = 'GitHub Discussion'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 6
  readonly defaultTtl = 3600

  constructor(private readonly client: GitHubClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 4 || parts[2] !== 'discussions') return null
    return { id: `${parts[0]}/${parts[1]}/discussions/${parts[3]}`, fullUrl: url.href, subtype: 'discussion' }
  }

  isValidId(id: string): boolean {
    return /^[^/]+\/[^/]+\/discussions\/\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const [owner, repo, , number] = id.split('/')
    const searchResult = await this.client.fetch<GitHubDiscussionSearchApiResponse>(
      `/search/discussions?q=repo:${owner}/${repo}+number:${number}`,
    )
    const discussion = searchResult.items?.[0]
    if (!discussion) throw new Error(`Discussion not found: ${id}`)

    return {
      title: discussion.title,
      description: (discussion.body || '').slice(0, 300) || undefined,
      image: discussion.user?.avatar_url ? { url: discussion.user.avatar_url, alt: discussion.user.login } : undefined,
      url: discussion.html_url,
      category: this.category,
      subtype: 'discussion',
      publishedAt: discussion.created_at || undefined,
      fetchedAt: '',
      attributes: [
        { key: 'author', value: discussion.user?.login || '', label: 'Author', format: 'text' },
        { key: 'comments', value: discussion.comments || 0, label: 'Comments', format: 'number' },
      ],
    }
  }
}

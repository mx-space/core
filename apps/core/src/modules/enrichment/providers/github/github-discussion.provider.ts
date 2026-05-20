import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import { GitHubClient } from './github.client'

@Injectable()
export class GitHubDiscussionProvider implements EnrichmentProvider {
  readonly name = 'gh-discussion'
  readonly displayName = 'GitHub Discussion'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 6
  readonly defaultTtl = 3600
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(private readonly client: GitHubClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 4 || parts[2] !== 'discussions') return null
    return {
      id: `${parts[0]}/${parts[1]}/discussions/${parts[3]}`,
      fullUrl: url.href,
      subtype: 'discussion',
    }
  }

  isValidId(id: string): boolean {
    return /^[^/]+\/[^/]+\/discussions\/\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const [owner, repo, , number] = id.split('/')
    const octokit = await this.client.getOctokit()
    const query = `
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          discussion(number: $number) {
            title
            body
            url
            createdAt
            updatedAt
            author { login avatarUrl }
            comments { totalCount }
          }
        }
      }
    `
    const data = await octokit.graphql<{
      repository: {
        discussion: {
          title: string
          body: string | null
          url: string
          createdAt: string | null
          updatedAt: string | null
          author: { login: string; avatarUrl: string } | null
          comments: { totalCount: number }
        } | null
      } | null
    }>(query, { owner, name: repo, number: Number(number) })

    const discussion = data?.repository?.discussion
    if (!discussion) throw new Error(`Discussion not found: ${id}`)

    const cacheToken = encodeURIComponent(
      discussion.updatedAt ?? new Date().toISOString(),
    )

    return {
      title: discussion.title,
      description: (discussion.body || '').slice(0, 300) || undefined,
      thumbnailImage: discussion.author?.avatarUrl
        ? { url: discussion.author.avatarUrl, alt: discussion.author.login }
        : undefined,
      previewImage: {
        url: `https://opengraph.githubassets.com/${cacheToken}/${owner}/${repo}/discussions/${number}`,
        width: 1280,
        height: 640,
        alt: `${discussion.title} · Discussion #${number} · ${owner}/${repo}`,
      },
      url: discussion.url,
      category: this.category,
      subtype: 'discussion',
      publishedAt: discussion.createdAt || undefined,
      fetchedAt: '',
      attributes: [
        {
          key: 'repo',
          value: `${owner}/${repo}`,
          label: 'Repository',
          format: 'text',
        },
        {
          key: 'number',
          value: Number(number),
          label: 'Number',
          format: 'number',
        },
        {
          key: 'author',
          value: discussion.author?.login || '',
          label: 'Author',
          format: 'text',
        },
        {
          key: 'comments',
          value: discussion.comments.totalCount || 0,
          label: 'Comments',
          format: 'number',
        },
      ],
    }
  }
}

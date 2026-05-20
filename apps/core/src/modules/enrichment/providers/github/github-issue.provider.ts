import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import { GitHubClient } from './github.client'

@Injectable()
export class GitHubIssueProvider implements EnrichmentProvider {
  readonly name = 'gh-issue'
  readonly displayName = 'GitHub Issue'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 8
  readonly defaultTtl = 1800
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(private readonly client: GitHubClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 4 || parts[2] !== 'issues') return null
    return {
      id: `${parts[0]}/${parts[1]}/issues/${parts[3]}`,
      fullUrl: url.href,
      subtype: 'issue',
    }
  }

  isValidId(id: string): boolean {
    return /^[^/]+\/[^/]+\/issues\/\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const repoPart = id.replace(/\/issues\/\d+$/, '')
    const [owner, repo, , issue_number] = id.split('/')
    const octokit = await this.client.getOctokit()
    const { data } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: Number(issue_number),
    })
    const attrs: NonNullable<EnrichmentResult['attributes']> = [
      { key: 'repo', value: repoPart, label: 'Repository', format: 'text' },
      {
        key: 'number',
        value: data.number,
        label: 'Number',
        format: 'number',
      },
    ]

    if (data.state)
      attrs.push({
        key: 'state',
        value: data.state,
        label: 'State',
        format: 'text',
      })
    if (data.comments != null)
      attrs.push({
        key: 'comments',
        value: data.comments,
        label: 'Comments',
        format: 'number',
      })
    if (data.user?.login)
      attrs.push({
        key: 'author',
        value: data.user.login,
        label: 'Author',
        format: 'text',
      })

    const cacheToken = encodeURIComponent(
      data.updated_at ?? new Date().toISOString(),
    )

    return {
      title: data.title,
      description: (data.body || '').slice(0, 300) || undefined,
      thumbnailImage: data.user?.avatar_url
        ? { url: data.user.avatar_url, alt: data.user.login }
        : undefined,
      previewImage: {
        url: `https://opengraph.githubassets.com/${cacheToken}/${owner}/${repo}/issues/${issue_number}`,
        width: 1280,
        height: 640,
        alt: `${data.title} · Issue #${issue_number} · ${owner}/${repo}`,
      },
      url: data.html_url,
      category: this.category,
      subtype: 'issue',
      publishedAt: data.created_at || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

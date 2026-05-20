import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import { GitHubClient } from './github.client'

@Injectable()
export class GitHubRepoProvider implements EnrichmentProvider {
  readonly name = 'gh-repo'
  readonly displayName = 'GitHub Repository'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 10
  readonly defaultTtl = 3600
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(private readonly client: GitHubClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 2) return null
    return { id: `${parts[0]}/${parts[1]}`, fullUrl: url.href, subtype: 'repo' }
  }

  isValidId(id: string): boolean {
    return /^[^/]+\/[^/]+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const [owner, repo] = id.split('/')
    const octokit = await this.client.getOctokit()
    const { data } = await octokit.rest.repos.get({ owner, repo })
    const attrs: NonNullable<EnrichmentResult['attributes']> = []

    if (data.stargazers_count != null)
      attrs.push({
        key: 'stars',
        value: data.stargazers_count,
        label: 'Stars',
        format: 'number',
      })
    if (data.forks_count != null)
      attrs.push({
        key: 'forks',
        value: data.forks_count,
        label: 'Forks',
        format: 'number',
      })
    if (data.language)
      attrs.push({
        key: 'language',
        value: data.language,
        label: 'Language',
        format: 'text',
      })
    if (data.license?.spdx_id)
      attrs.push({
        key: 'license',
        value: data.license.spdx_id,
        label: 'License',
        format: 'text',
      })

    const cacheToken = encodeURIComponent(
      data.pushed_at ?? data.updated_at ?? new Date().toISOString(),
    )

    return {
      title: data.full_name || id,
      description: data.description || undefined,
      thumbnailImage: data.owner?.avatar_url
        ? { url: data.owner.avatar_url, alt: `${data.owner.login} avatar` }
        : undefined,
      previewImage: {
        url: `https://opengraph.githubassets.com/${cacheToken}/${owner}/${repo}`,
        width: 1280,
        height: 640,
        alt: `${data.full_name || id} on GitHub`,
      },
      url: data.html_url || `https://github.com/${id}`,
      category: this.category,
      subtype: 'repo',
      publishedAt: data.created_at || undefined,
      fetchedAt: '',
      attributes: attrs,
      color: data.language || undefined,
    }
  }
}

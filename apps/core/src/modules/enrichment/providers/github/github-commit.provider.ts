import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import { GitHubClient } from './github.client'

@Injectable()
export class GitHubCommitProvider implements EnrichmentProvider {
  readonly name = 'gh-commit'
  readonly displayName = 'GitHub Commit'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 7
  readonly defaultTtl = 7200
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(private readonly client: GitHubClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 4 || parts[2] !== 'commit') return null
    return {
      id: `${parts[0]}/${parts[1]}/commits/${parts[3]}`,
      fullUrl: url.href,
      subtype: 'commit',
    }
  }

  isValidId(id: string): boolean {
    return /^[^/]+\/[^/]+\/commits\/[\da-f]+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const [owner, repo, , ref] = id.split('/')
    const octokit = await this.client.getOctokit()
    const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref })
    const attrs: NonNullable<EnrichmentResult['attributes']> = []

    if (data.author?.login)
      attrs.push({
        key: 'author',
        value: data.author.login,
        label: 'Author',
        format: 'text',
      })
    if (data.stats?.additions != null)
      attrs.push({
        key: 'additions',
        value: data.stats.additions,
        label: 'Additions',
        format: 'number',
      })
    if (data.stats?.deletions != null)
      attrs.push({
        key: 'deletions',
        value: data.stats.deletions,
        label: 'Deletions',
        format: 'number',
      })

    return {
      title: data.commit?.message?.split('\n')[0] || id,
      description:
        data.commit?.message?.split('\n').slice(1).join('\n').trim() ||
        undefined,
      thumbnailImage: data.author?.avatar_url
        ? { url: data.author.avatar_url, alt: data.author.login }
        : undefined,
      url: data.html_url,
      category: this.category,
      subtype: 'commit',
      publishedAt: data.commit?.author?.date || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

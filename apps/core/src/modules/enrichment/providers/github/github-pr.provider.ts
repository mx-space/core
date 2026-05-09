import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import { GitHubClient } from './github.client'

@Injectable()
export class GitHubPrProvider implements EnrichmentProvider {
  readonly name = 'gh-pr'
  readonly displayName = 'GitHub Pull Request'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 9
  readonly defaultTtl = 1800
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(private readonly client: GitHubClient) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.hostname !== 'github.com') return null
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length !== 4 || parts[2] !== 'pull') return null
    return {
      id: `${parts[0]}/${parts[1]}/pulls/${parts[3]}`,
      fullUrl: url.href,
      subtype: 'pr',
    }
  }

  isValidId(id: string): boolean {
    return /^[^/]+\/[^/]+\/pulls\/\d+$/.test(id)
  }

  async fetch(id: string): Promise<EnrichmentResult> {
    const repoPart = id.replace(/\/pulls\/\d+$/, '')
    const [owner, repo, , pull_number] = id.split('/')
    const octokit = await this.client.getOctokit()
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: Number(pull_number),
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

    const state = data.merged ? 'merged' : data.state
    if (state)
      attrs.push({
        key: 'state',
        value: state,
        label: 'State',
        format: 'text',
      })
    if (data.merged) attrs.push({ key: 'merged', value: true, label: 'Merged' })
    if (data.additions != null)
      attrs.push({
        key: 'additions',
        value: data.additions,
        label: 'Additions',
        format: 'number',
      })
    if (data.deletions != null)
      attrs.push({
        key: 'deletions',
        value: data.deletions,
        label: 'Deletions',
        format: 'number',
      })
    if (data.user?.login)
      attrs.push({
        key: 'author',
        value: data.user.login,
        label: 'Author',
        format: 'text',
      })

    return {
      title: data.title,
      description: (data.body || '').slice(0, 300) || undefined,
      image: data.user?.avatar_url
        ? { url: data.user.avatar_url, alt: data.user.login }
        : undefined,
      url: data.html_url,
      category: this.category,
      subtype: 'pr',
      publishedAt: data.created_at || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

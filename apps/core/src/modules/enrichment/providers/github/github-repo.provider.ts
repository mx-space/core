import { Injectable } from '@nestjs/common'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ImageMetaService } from '../image-meta.service'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type { EnrichmentProvider } from '../provider.interface'
import {
  buildOgImageUrl,
  GitHubClient,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from './github.client'

@Injectable()
export class GitHubRepoProvider implements EnrichmentProvider {
  readonly name = 'gh-repo'
  readonly displayName = 'GitHub Repository'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 10
  readonly defaultTtl = 3600
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(
    private readonly client: GitHubClient,
    private readonly imageMeta: ImageMetaService,
  ) {}

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

    const avatarUrl = data.owner?.avatar_url ?? null
    const ogUrl = buildOgImageUrl(
      data.pushed_at ?? data.updated_at,
      owner,
      repo,
    )
    const [avatarMeta, ogMeta] = await Promise.all([
      avatarUrl ? this.imageMeta.fetchAndExtract(avatarUrl) : null,
      this.imageMeta.fetchAndExtract(ogUrl),
    ])

    return {
      title: data.full_name || id,
      description: data.description || undefined,
      thumbnailImage: avatarUrl
        ? {
            url: avatarUrl,
            alt: `${data.owner!.login} avatar`,
            ...avatarMeta,
          }
        : undefined,
      previewImage: {
        url: ogUrl,
        ...ogMeta,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
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

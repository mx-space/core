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
export class GitHubCommitProvider implements EnrichmentProvider {
  readonly name = 'gh-commit'
  readonly displayName = 'GitHub Commit'
  readonly category = ENRICHMENT_CATEGORIES.GITHUB
  readonly priority = 7
  readonly defaultTtl = 7200
  readonly featureGateConfigKey = 'github'
  readonly requiredConfigKeys = ['token']

  constructor(
    private readonly client: GitHubClient,
    private readonly imageMeta: ImageMetaService,
  ) {}

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

    const avatarUrl = data.author?.avatar_url ?? null
    const ogUrl = buildOgImageUrl(
      data.commit?.author?.date,
      owner,
      repo,
      'commit',
      ref,
    )
    const [avatarMeta, ogMeta] = await Promise.all([
      avatarUrl ? this.imageMeta.fetchAndExtract(avatarUrl) : null,
      this.imageMeta.fetchAndExtract(ogUrl),
    ])

    return {
      title: data.commit?.message?.split('\n')[0] || id,
      description:
        data.commit?.message?.split('\n').slice(1).join('\n').trim() ||
        undefined,
      thumbnailImage: avatarUrl
        ? {
            url: avatarUrl,
            alt: data.author!.login,
            ...avatarMeta,
          }
        : undefined,
      previewImage: {
        url: ogUrl,
        ...ogMeta,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: `${data.commit?.message?.split('\n')[0] || ref} · ${owner}/${repo}`,
      },
      url: data.html_url,
      category: this.category,
      subtype: 'commit',
      publishedAt: data.commit?.author?.date || undefined,
      fetchedAt: '',
      attributes: attrs,
    }
  }
}

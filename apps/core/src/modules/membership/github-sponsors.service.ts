import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

import { ConfigsService } from '../configs/configs.service'
import { MembershipRepository } from './membership.repository'
import { MembershipService } from './membership.service'
import {
  type GithubSponsorRow,
  resolveGrantExtension,
  type SponsorGrantResult,
} from './membership.types'

const CACHE_TTL_MS = 5 * 60 * 1000

const SPONSORS_QUERY = /* GraphQL */ `
  query ($after: String) {
    viewer {
      sponsorshipsAsMaintainer(
        first: 100
        after: $after
        includePrivate: true
        activeOnly: false
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          createdAt
          isActive
          tier {
            name
            monthlyPriceInDollars
          }
          sponsorEntity {
            ... on User {
              databaseId
              login
              avatarUrl
            }
            ... on Organization {
              databaseId
              login
              avatarUrl
            }
          }
        }
      }
    }
  }
`

interface SponsorshipNode {
  createdAt: string
  isActive: boolean
  tier: { name: string; monthlyPriceInDollars: number } | null
  sponsorEntity: {
    databaseId: number
    login: string
    avatarUrl: string
  } | null
}

interface SponsorsQueryResult {
  viewer: {
    sponsorshipsAsMaintainer: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: SponsorshipNode[]
    }
  }
}

type RawSponsor = Omit<GithubSponsorRow, 'reader'>

@Injectable()
export class GithubSponsorsService {
  private cache: { fetchedAt: number; sponsors: RawSponsor[] } | null = null

  constructor(
    private readonly configsService: ConfigsService,
    private readonly membershipRepository: MembershipRepository,
    private readonly membershipService: MembershipService,
  ) {}

  async list(force = false): Promise<GithubSponsorRow[]> {
    const sponsors = await this.fetchSponsors(force)
    const readers =
      await this.membershipRepository.findReadersByGithubAccountIds(
        sponsors.map((s) => s.githubId),
      )
    return sponsors.map((s) => ({
      ...s,
      reader: readers.get(s.githubId) ?? null,
    }))
  }

  async importGrants(
    grants: { readerId: string; months: number }[],
  ): Promise<SponsorGrantResult> {
    const result: SponsorGrantResult = { granted: 0, skipped: [] }
    for (const grant of grants) {
      const existing = await this.membershipRepository.findByReaderId(
        grant.readerId,
      )
      try {
        await this.membershipService.grantManual(
          grant.readerId,
          resolveGrantExtension(existing, grant.months),
        )
        result.granted += 1
      } catch (error) {
        result.skipped.push({
          readerId: grant.readerId,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return result
  }

  private async fetchSponsors(force: boolean): Promise<RawSponsor[]> {
    if (
      !force &&
      this.cache &&
      Date.now() - this.cache.fetchedAt < CACHE_TTL_MS
    ) {
      return this.cache.sponsors
    }

    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const token = config?.github?.token
    if (!token) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'GitHub token is not configured',
      })
    }

    const { Octokit } = await import('octokit')
    const octokit = new Octokit({ auth: token })
    const sponsors: RawSponsor[] = []
    let after: string | null = null
    do {
      const data: SponsorsQueryResult = await octokit.graphql(SPONSORS_QUERY, {
        after,
      })
      const page = data.viewer.sponsorshipsAsMaintainer
      for (const node of page.nodes) {
        if (!node.sponsorEntity) continue
        sponsors.push({
          githubId: String(node.sponsorEntity.databaseId),
          login: node.sponsorEntity.login,
          avatarUrl: node.sponsorEntity.avatarUrl,
          tierName: node.tier?.name ?? null,
          monthlyPrice: node.tier?.monthlyPriceInDollars ?? null,
          isActive: node.isActive,
          sponsoredAt: new Date(node.createdAt),
        })
      }
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
    } while (after)

    this.cache = { fetchedAt: Date.now(), sponsors }
    return sponsors
  }
}

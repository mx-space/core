import { Injectable, Logger } from '@nestjs/common'
import { Octokit } from 'octokit'

import { ConfigsService } from '~/modules/configs/configs.service'

export const OG_IMAGE_WIDTH = 1280
export const OG_IMAGE_HEIGHT = 640

export function buildOgImageUrl(
  cacheTimestamp: string | null | undefined,
  ...pathSegments: string[]
): string {
  const cacheToken = encodeURIComponent(
    cacheTimestamp ?? new Date().toISOString(),
  )
  return `https://opengraph.githubassets.com/${cacheToken}/${pathSegments.join('/')}`
}

@Injectable()
export class GitHubClient {
  private readonly logger = new Logger(GitHubClient.name)

  constructor(private readonly configsService: ConfigsService) {}

  async getOctokit(): Promise<Octokit> {
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const token = config?.github?.token || undefined
    return new Octokit({ auth: token })
  }
}

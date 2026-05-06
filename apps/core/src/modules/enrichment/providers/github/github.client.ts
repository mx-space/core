import { Injectable, Logger } from '@nestjs/common'
import { Octokit } from 'octokit'

import { ConfigsService } from '~/modules/configs/configs.service'

@Injectable()
export class GitHubClient {
  private readonly logger = new Logger(GitHubClient.name)

  constructor(private readonly configsService: ConfigsService) {}

  async getOctokit(): Promise<Octokit> {
    const config =
      await this.configsService.get('thirdPartyServiceIntegration')
    const token = config?.github?.token || undefined
    return new Octokit({ auth: token })
  }

  async fetch<T = any>(path: string): Promise<T> {
    const octokit = await this.getOctokit()
    const res = await octokit.request(`GET ${path}`)
    return res.data as T
  }
}

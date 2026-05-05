import { Injectable } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

@Injectable()
export class GitHubClient {
  constructor(private readonly configsService: ConfigsService) {}

  async getToken(): Promise<string | undefined> {
    const config =
      await this.configsService.get('thirdPartyServiceIntegration')
    return config?.github?.token || undefined
  }

  async fetch<T = any>(path: string): Promise<T> {
    const token = await this.getToken()
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'GitHub-Api-Version': '2022-11-28',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(`https://api.github.com${path}`, { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }
}

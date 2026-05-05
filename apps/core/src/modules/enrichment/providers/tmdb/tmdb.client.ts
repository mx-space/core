import { Injectable } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

@Injectable()
export class TmdbClient {
  constructor(private readonly configsService: ConfigsService) {}

  async getApiKey(): Promise<string | undefined> {
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    return config?.tmdb?.apiKey || undefined
  }

  async fetch<T = any>(path: string): Promise<T> {
    const apiKey = await this.getApiKey()
    if (!apiKey) throw new Error('TMDB API key not configured')

    const url = new URL(path, 'https://api.themoviedb.org')
    url.searchParams.set('api_key', apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`TMDB API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }
}

import { isIP } from 'node:net'

import { Injectable, Logger } from '@nestjs/common'

import { HttpService } from '~/processors/helper/helper.http.service'
import { RedisService } from '~/processors/redis/redis.service'

const REDIS_KEY_PREFIX = 'geoip:'
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const LOOKUP_TIMEOUT_MS = 5000
const FREEIPAPI_BASE = 'https://freeipapi.com/api/json/'

interface FreeIpApiResponse {
  countryCode?: string
}

/**
 * Resolves a 2-letter country code for a comment's IP. Used on write to
 * persist `comments.country_code` (spec §6.4).
 *
 * Order: cf-ipcountry header hint → Redis cache → freeipapi.com (same
 * upstream as the built-in `ip` serverless function admin already uses).
 * Failures resolve to `null` so writes never block on geoip lookup.
 */
@Injectable()
export class CommentCountryService {
  private readonly logger = new Logger(CommentCountryService.name)

  constructor(
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
  ) {}

  async lookupCountryCode(
    ip: string | null | undefined,
    options: { cfHint?: string | null } = {},
  ): Promise<string | null> {
    if (!ip) return null
    const trimmed = ip.trim()
    if (!trimmed || !isIP(trimmed)) return null

    const fromHint = this.normalizeCountryCode(options.cfHint)
    if (fromHint) {
      void this.writeCache(trimmed, fromHint).catch(() => {})
      return fromHint
    }

    const cached = await this.readCache(trimmed)
    if (cached !== undefined) return cached

    const fetched = await this.fetchFromUpstream(trimmed)
    await this.writeCache(trimmed, fetched).catch((err) => {
      this.logger.warn(
        `geoip cache write failed for ${trimmed}: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
    return fetched
  }

  private async readCache(ip: string): Promise<string | null | undefined> {
    try {
      const client = this.redisService.getClient()
      const value = await client.get(`${REDIS_KEY_PREFIX}${ip}`)
      if (value === null) return undefined
      if (value === '') return null
      return value
    } catch (err) {
      this.logger.debug(`geoip cache read failed for ${ip}: ${String(err)}`)
      return undefined
    }
  }

  private async writeCache(ip: string, value: string | null): Promise<void> {
    const client = this.redisService.getClient()
    await client.set(
      `${REDIS_KEY_PREFIX}${ip}`,
      value ?? '',
      'EX',
      CACHE_TTL_SECONDS,
    )
  }

  private async fetchFromUpstream(ip: string): Promise<string | null> {
    try {
      const data = await this.httpService.fetch<FreeIpApiResponse>(
        `${FREEIPAPI_BASE}${ip}`,
        { timeout: LOOKUP_TIMEOUT_MS },
      )
      return this.normalizeCountryCode(data?.countryCode)
    } catch (err) {
      this.logger.warn(
        `geoip upstream failed for ${ip}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return null
    }
  }

  private normalizeCountryCode(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const upper = value.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(upper)) return null
    return upper
  }
}

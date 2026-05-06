import { createHash } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'
import { RedisService } from '~/processors/redis/redis.service'

import { EnrichmentRepository } from './enrichment.repository'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'
import { ProviderDisabledError, TokenMissingError } from './enrichment.types'
import { ProviderRegistry } from './providers/provider.registry'

const REDIS_KEY_PREFIX = 'enrichment:resolve:'
const REDIS_TTL = 600
const BACKOFF_BASE = 60
const BACKOFF_MAX = 86400

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name)

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly repository: EnrichmentRepository,
    private readonly configsService: ConfigsService,
    private readonly redisService: RedisService,
  ) {}

  async resolve(
    url: string,
  ): Promise<{ result: EnrichmentResult; stale?: boolean }> {
    // 1. Redis cache
    const redisHit = await this.getFromRedis(url)
    if (redisHit) return { result: redisHit }

    // 2. Match URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    const matched = this.providerRegistry.match(parsedUrl)
    if (!matched) throw new ProviderDisabledError('unknown')

    const { provider, match } = matched

    // 3. Check enabled + token
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    if (!this.isProviderEnabled(provider, config)) {
      throw new ProviderDisabledError(provider.name)
    }
    if (
      provider.requiredConfigKeys?.length &&
      !this.hasRequiredConfig(provider, config)
    ) {
      throw new TokenMissingError(provider.name)
    }

    // 4. DB cache
    const dbRow = await this.repository.findByProviderAndExternalId(
      provider.name,
      match.id,
    )
    const now = new Date()

    if (dbRow) {
      const isExpired = dbRow.expiresAt && dbRow.expiresAt < now
      if (!isExpired) {
        await this.setToRedis(url, dbRow.normalized)
        return { result: dbRow.normalized }
      }
      // Expired + backoff
      const backoffSeconds = this.calculateBackoff(dbRow.failureCount)
      const backoffUntil = new Date(
        dbRow.fetchedAt.getTime() + backoffSeconds * 1000,
      )
      if (dbRow.failureCount > 0 && now < backoffUntil) {
        return { result: dbRow.normalized, stale: true }
      }
    }

    // 5. Fetch fresh
    try {
      const result = await provider.fetch(match.id)
      result.fetchedAt = new Date().toISOString()
      result.category = provider.category
      if (match.subtype) result.subtype = match.subtype

      const expiresAt = new Date(Date.now() + provider.defaultTtl * 1000)
      await this.repository.upsert(
        provider.name,
        match.id,
        match.fullUrl,
        result,
        null,
        expiresAt,
      )
      await this.setToRedis(url, result)
      return { result }
    } catch (error) {
      this.logger.warn(
        `Provider ${provider.name} fetch failed for ${match.id}: ${error.message}`,
      )
      if (dbRow?.normalized) {
        await this.repository.recordFailure(
          provider.name,
          match.id,
          error.message,
        )
        return { result: dbRow.normalized, stale: true }
      }
      throw error
    }
  }

  /**
   * Pure URL → { provider, externalId } match. No I/O, no fetch. Returns null
   * if no provider matches the URL or the URL is malformed.
   */
  matchUrlToRef(url: string): { provider: string; externalId: string } | null {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return null
    }
    const matched = this.providerRegistry.match(parsedUrl)
    if (!matched) return null
    return { provider: matched.provider.name, externalId: matched.match.id }
  }

  async getOne(providerName: string, id: string): Promise<EnrichmentResult> {
    const provider = this.providerRegistry.getByName(providerName)
    if (!provider) throw new Error(`Unknown provider: ${providerName}`)

    const row = await this.repository.findByProviderAndExternalId(
      providerName,
      id,
    )
    if (row) return row.normalized

    const result = await provider.fetch(id)
    result.fetchedAt = new Date().toISOString()
    result.category = provider.category

    const expiresAt = new Date(Date.now() + provider.defaultTtl * 1000)
    await this.repository.upsert(
      providerName,
      id,
      result.url,
      result,
      null,
      expiresAt,
    )
    return result
  }

  async refresh(providerName: string, id: string): Promise<EnrichmentResult> {
    const provider = this.providerRegistry.getByName(providerName)
    if (!provider) throw new Error(`Unknown provider: ${providerName}`)

    const result = await provider.fetch(id)
    result.fetchedAt = new Date().toISOString()
    result.category = provider.category

    const expiresAt = new Date(Date.now() + provider.defaultTtl * 1000)
    await this.repository.upsert(
      providerName,
      id,
      result.url,
      result,
      null,
      expiresAt,
    )
    await this.deleteFromRedis(result.url)
    return result
  }

  async invalidate(providerName: string, id: string): Promise<void> {
    const row = await this.repository.findByProviderAndExternalId(
      providerName,
      id,
    )
    if (row) {
      await this.deleteFromRedis(row.url)
      await this.repository.deleteByProviderAndExternalId(providerName, id)
    }
  }

  async list(page: number, size: number, opts?: { onlyFailed?: boolean }) {
    return this.repository.listPaginated(page, size, opts)
  }

  getProviders(): ProviderMeta[] {
    return this.providerRegistry.getProviderMetas(() => true)
  }

  private async getFromRedis(url: string): Promise<EnrichmentResult | null> {
    const client = this.redisService.getClient()
    const cached = await client.get(this.redisKey(url))
    if (!cached) return null
    try {
      return JSON.parse(cached) as EnrichmentResult
    } catch {
      return null
    }
  }

  private async setToRedis(
    url: string,
    result: EnrichmentResult,
  ): Promise<void> {
    const client = this.redisService.getClient()
    await client.set(
      this.redisKey(url),
      JSON.stringify(result),
      'EX',
      REDIS_TTL,
    )
  }

  private async deleteFromRedis(url: string): Promise<void> {
    const client = this.redisService.getClient()
    await client.del(this.redisKey(url))
  }

  private redisKey(url: string): string {
    const hash = createHash('sha1').update(url).digest('hex')
    return `${REDIS_KEY_PREFIX}${hash}`
  }

  private calculateBackoff(failureCount: number): number {
    return Math.min(BACKOFF_BASE * Math.pow(2, failureCount), BACKOFF_MAX)
  }

  private isProviderEnabled(provider: any, config: any): boolean {
    const configKeyMap: Record<string, string | undefined> = {
      github: 'github',
      media: 'tmdb',
      academic: 'arxiv',
      code: 'leetcode',
      self: undefined,
      music: 'neteaseMusic',
      book: 'neodb',
    }
    const configKey = configKeyMap[provider.category]
    if (!configKey || !config[configKey]) return true
    return config[configKey].enabled !== false
  }

  private hasRequiredConfig(provider: any, config: any): boolean {
    const configKeyMap: Record<string, string> = {
      github: 'github',
      media: 'tmdb',
      music: 'neteaseMusic',
    }
    const configKey = configKeyMap[provider.category]
    if (!configKey || !config[configKey]) return false
    const section = config[configKey]
    return Object.entries(section).some(
      ([key, val]) =>
        key !== 'enabled' && typeof val === 'string' && val.length > 0,
    )
  }
}

import { createHash } from 'node:crypto'

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import type { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { RedisService } from '~/processors/redis/redis.service'
import { TaskQueueProcessor, TaskQueueService } from '~/processors/task-queue'
import { scheduleManager } from '~/utils/schedule.util'

import { EnrichmentRepository } from './enrichment.repository'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'
import { ProviderDisabledError, TokenMissingError } from './enrichment.types'
import type { EnrichmentProvider } from './providers/provider.interface'
import { ProviderRegistry } from './providers/provider.registry'
import type { ContentDoc } from './url-extractor.service'
import { UrlExtractorService } from './url-extractor.service'

type ThirdPartyConfig = IConfig['thirdPartyServiceIntegration']

const REDIS_KEY_PREFIX = 'enrichment:resolve:'
const REDIS_TTL = 600
const BACKOFF_BASE = 60
const BACKOFF_MAX = 86400

const ENRICHMENT_REFRESH_TASK_TYPE = 'enrichment:refresh'
const ENRICHMENT_TASK_SCOPE = 'enrichment'

interface EnrichmentRefreshPayload extends Record<string, unknown> {
  provider: string
  externalId: string
}

@Injectable()
export class EnrichmentService implements OnModuleInit {
  private readonly logger = new Logger(EnrichmentService.name)

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly repository: EnrichmentRepository,
    private readonly configsService: ConfigsService,
    private readonly redisService: RedisService,
    private readonly imageService: ImageService,
    private readonly taskQueueService: TaskQueueService,
    private readonly taskQueueProcessor: TaskQueueProcessor,
    private readonly urlExtractor: UrlExtractorService,
  ) {}

  onModuleInit() {
    this.taskQueueProcessor.registerHandler<EnrichmentRefreshPayload>({
      type: ENRICHMENT_REFRESH_TASK_TYPE,
      execute: async (payload: EnrichmentRefreshPayload) => {
        try {
          await this.refresh(payload.provider, payload.externalId)
        } catch (error) {
          // Record per-row failure so backoff kicks in on subsequent SWR
          // resolves; re-throw so the task queue marks the task failed.
          this.logger.warn(
            `Enrichment refresh task failed for ${payload.provider}:${payload.externalId}: ${error.message}`,
          )
          try {
            await this.repository.recordFailure(
              payload.provider,
              payload.externalId,
              error.message,
            )
          } catch (recordError) {
            this.logger.warn(
              `recordFailure failed for ${payload.provider}:${payload.externalId}: ${recordError.message}`,
            )
          }
          throw error
        }
      },
    })
  }

  async resolve(
    url: string,
  ): Promise<{ result: EnrichmentResult; stale?: boolean }> {
    const redisHit = await this.getFromRedis(url)
    if (redisHit) return { result: redisHit }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    const matched = this.providerRegistry.match(parsedUrl)
    if (!matched) throw new ProviderDisabledError('unknown')

    const { provider, match } = matched

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

    // SWR: return any existing row immediately, refresh in background when
    // expired and not in failure backoff.
    const dbRow = await this.repository.findByProviderAndExternalId(
      provider.name,
      match.id,
    )
    const now = new Date()

    if (dbRow) {
      const isExpired = !!dbRow.expiresAt && dbRow.expiresAt < now

      if (isExpired) {
        const inBackoff = this.isInFailureBackoff(dbRow, now)
        if (!inBackoff) {
          this.enqueueRefresh(provider.name, match.id)
        }
        return { result: dbRow.normalized, stale: true }
      }

      await this.setToRedis(url, dbRow.normalized)
      return { result: dbRow.normalized }
    }

    try {
      const result = await this.fetchAndPersist(provider, match.id, {
        url: match.fullUrl,
        subtype: match.subtype,
      })
      await this.setToRedis(url, result)
      return { result }
    } catch (error) {
      this.logger.warn(
        `Provider ${provider.name} fetch failed for ${match.id}: ${error.message}`,
      )
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

    return this.fetchAndPersist(provider, id)
  }

  async refresh(providerName: string, id: string): Promise<EnrichmentResult> {
    const provider = this.providerRegistry.getByName(providerName)
    if (!provider) throw new Error(`Unknown provider: ${providerName}`)

    const result = await this.fetchAndPersist(provider, id)
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

  /**
   * Bulk URL → cached EnrichmentResult lookup. Returns any existing row
   * (including expired ones) so SSR hydration matches SWR semantics; for
   * expired non-backoff rows, also enqueues a background refresh. For refs
   * with no cache row at all, enqueues a refresh when the provider is ready
   * — first GET returns empty, subsequent GETs are warm.
   */
  async hydrateUrls(
    urls: readonly string[],
  ): Promise<Record<string, EnrichmentResult>> {
    if (urls.length === 0) return {}
    const unique = [...new Set(urls)]
    const urlByRef = new Map<string, string>()
    const refs: { provider: string; externalId: string }[] = []
    for (const url of unique) {
      const ref = this.matchUrlToRef(url)
      if (!ref) continue
      const key = `${ref.provider}:${ref.externalId}`
      if (urlByRef.has(key)) continue
      urlByRef.set(key, url)
      refs.push(ref)
    }
    if (refs.length === 0) return {}

    const rows = await this.repository.findManyByRefs(refs)
    const now = new Date()
    const out: Record<string, EnrichmentResult> = {}
    const seenKeys = new Set<string>()
    for (const row of rows) {
      const key = `${row.provider}:${row.externalId}`
      seenKeys.add(key)
      const url = urlByRef.get(key)
      if (!url) continue
      const isExpired = !!row.expiresAt && row.expiresAt < now
      if (isExpired && !this.isInFailureBackoff(row, now)) {
        this.enqueueRefresh(row.provider, row.externalId)
      }
      out[url] = row.normalized
    }

    const missing = refs.filter(
      (r) => !seenKeys.has(`${r.provider}:${r.externalId}`),
    )
    if (missing.length > 0) {
      const config = await this.configsService.get(
        'thirdPartyServiceIntegration',
      )
      for (const ref of missing) {
        const provider = this.providerRegistry.getByName(ref.provider)
        if (!provider) continue
        if (!this.isProviderReady(provider, config)) continue
        this.enqueueRefresh(ref.provider, ref.externalId)
      }
    }
    return out
  }

  async prefetchUrls(urls: readonly string[]): Promise<void> {
    if (urls.length === 0) return
    const unique = [...new Set(urls)]
    const ready: string[] = []
    let config: ThirdPartyConfig | undefined
    for (const url of unique) {
      const ref = this.matchUrlToRef(url)
      if (!ref) continue
      const provider = this.providerRegistry.getByName(ref.provider)
      if (!provider) continue
      config ??= await this.configsService.get('thirdPartyServiceIntegration')
      if (!this.isProviderReady(provider, config)) continue
      ready.push(url)
    }
    if (ready.length === 0) return

    await Promise.all(
      ready.map(async (url) => {
        try {
          await this.resolve(url)
        } catch (error) {
          this.logger.warn(`prefetch failed for ${url}: ${error.message}`)
        }
      }),
    )
  }

  /**
   * Schedule a non-blocking prefetch of every link-card URL in the doc.
   * Owned by EnrichmentService so post/note/page services share one hook
   * instead of triplicating the extract→prefetch wiring.
   */
  scheduleDocPrefetch(doc: ContentDoc): void {
    scheduleManager.schedule(async () => {
      const urls = this.urlExtractor.extractFromDoc(doc)
      if (urls.length === 0) return
      await this.prefetchUrls(urls)
    })
  }

  private isProviderReady(
    provider: EnrichmentProvider,
    config: ThirdPartyConfig,
  ): boolean {
    if (!this.isProviderEnabled(provider, config)) return false
    if (
      provider.requiredConfigKeys?.length &&
      !this.hasRequiredConfig(provider, config)
    ) {
      return false
    }
    return true
  }

  async getProviders(): Promise<ProviderMeta[]> {
    const config = await this.configsService.get('thirdPartyServiceIntegration')
    return this.providerRegistry.getProviderMetas((provider) => {
      const enabled = this.isProviderEnabled(provider, config)
      const missingKeys = enabled
        ? this.getMissingConfigKeys(provider, config)
        : []
      return {
        enabled,
        ready: enabled && missingKeys.length === 0,
        missingKeys,
      }
    })
  }

  /**
   * Cold-path fetch shared by `resolve`, `getOne`, and `refresh`: calls the
   * provider, stamps category/subtype/fetchedAt, runs image-meta enrichment,
   * upserts the row, and returns the result.
   */
  private async fetchAndPersist(
    provider: EnrichmentProvider,
    externalId: string,
    opts?: { url?: string; subtype?: string },
  ): Promise<EnrichmentResult> {
    const result = await provider.fetch(externalId)
    result.fetchedAt = new Date().toISOString()
    result.category = provider.category
    if (opts?.subtype) result.subtype = opts.subtype

    await this.enrichWithImageMeta(result)

    const expiresAt = new Date(Date.now() + provider.defaultTtl * 1000)
    await this.repository.upsert(
      provider.name,
      externalId,
      opts?.url ?? result.url,
      result,
      null,
      expiresAt,
    )
    return result
  }

  /**
   * Best-effort enrichment of an EnrichmentResult with image-derived metadata
   * (dominant accent color, blurhash, dimensions). Mutates `result` in place.
   * Skipped when no image URL is set or when `color` is already populated
   * (preserves provider-specific writes such as github-repo's language name).
   */
  private async enrichWithImageMeta(result: EnrichmentResult): Promise<void> {
    if (!result.image?.url) return
    if (result.color) return

    try {
      const { size, accent, blurHash } =
        await this.imageService.getOnlineImageSizeAndMeta(result.image.url)
      result.color = accent
      result.image.blurhash = blurHash
      if (size.width != null) result.image.width = size.width
      if (size.height != null) result.image.height = size.height
    } catch (error) {
      this.logger.warn(
        `Image meta extraction failed for ${result.url}: ${error.message}`,
      )
      // swallow — color/blurhash/size are optional fields
    }
  }

  private enqueueRefresh(providerName: string, externalId: string): void {
    const dedupKey = `${providerName}:${externalId}`
    void this.taskQueueService
      .createTask({
        type: ENRICHMENT_REFRESH_TASK_TYPE,
        scope: ENRICHMENT_TASK_SCOPE,
        dedupKey,
        payload: {
          provider: providerName,
          externalId,
        } satisfies EnrichmentRefreshPayload,
      })
      .catch((error) => {
        this.logger.warn(
          `Failed to enqueue enrichment refresh for ${providerName}:${externalId}: ${error.message}`,
        )
      })
  }

  private isInFailureBackoff(
    row: { failureCount: number; fetchedAt: Date },
    now: Date,
  ): boolean {
    if (row.failureCount <= 0) return false
    const backoffSeconds = this.calculateBackoff(row.failureCount)
    const backoffUntil = new Date(
      row.fetchedAt.getTime() + backoffSeconds * 1000,
    )
    return now < backoffUntil
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

  /**
   * Honors `provider.featureGateConfigKey`: if the provider declares no gate,
   * it is always enabled. If the config section exists, respect its `enabled`
   * flag; missing section is treated as enabled (matching default-on
   * behavior) so a fresh install resolves before the dashboard is opened.
   */
  private isProviderEnabled(
    provider: EnrichmentProvider,
    config: ThirdPartyConfig,
  ): boolean {
    const gate = provider.featureGateConfigKey
    if (!gate) return true
    const section = config?.[gate]
    if (!section) return true
    return section.enabled !== false
  }

  private hasRequiredConfig(
    provider: EnrichmentProvider,
    config: ThirdPartyConfig,
  ): boolean {
    return this.getMissingConfigKeys(provider, config).length === 0
  }

  private getMissingConfigKeys(
    provider: EnrichmentProvider,
    config: ThirdPartyConfig,
  ): string[] {
    const required = provider.requiredConfigKeys
    if (!required?.length) return []
    const gate = provider.featureGateConfigKey
    const section = gate ? config?.[gate] : undefined
    return required.filter((key) => {
      const val = section?.[key]
      return typeof val !== 'string' || val.length === 0
    })
  }
}

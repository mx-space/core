import { createHash } from 'node:crypto'

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { RequestContext } from '~/common/contexts/request.context'
import type { IConfig } from '~/modules/configs/configs.interface'
import { ConfigsService } from '~/modules/configs/configs.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { RedisService } from '~/processors/redis/redis.service'
import { TaskQueueProcessor, TaskQueueService } from '~/processors/task-queue'
import { resolveRequestedLanguage } from '~/utils/lang.util'
import { scheduleManager } from '~/utils/schedule.util'

import { EnrichmentRepository } from './enrichment.repository'
import type { EnrichmentResult, ProviderMeta } from './enrichment.types'
import {
  ChallengeBlockedError,
  ProviderDisabledError,
  TokenMissingError,
} from './enrichment.types'
import { BrowserFetchService } from './providers/open-graph/browser-fetch.service'
import { CapturePipelineService } from './providers/open-graph/capture-pipeline.service'
import { CaptureStorageService } from './providers/open-graph/capture-storage.service'
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
  locale: string
  url?: string
}

interface EnrichmentRefInput {
  provider: string
  externalId: string
  url?: string
}

/**
 * Stable string key used by {@link EnrichmentService.hydrateRefs} consumers.
 * `\t` separator avoids collisions with provider names or external ids that
 * legitimately contain `:` or `/`.
 */
export function refKey(provider: string, externalId: string): string {
  return `${provider}\t${externalId}`
}

/**
 * Stamp the cache row id onto `normalized` and return it. The argument is
 * always a freshly-deserialized object (a Drizzle row's JSON column or a
 * JSON.parse'd Redis payload) so in-place mutation is safe and avoids an
 * extra allocation per cache hit.
 */
function stampRowId(
  normalized: EnrichmentResult,
  rowId: string,
): EnrichmentResult {
  normalized.id = rowId
  return normalized
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
    private readonly browserFetch: BrowserFetchService,
    private readonly capturePipeline: CapturePipelineService,
    private readonly captureStorage: CaptureStorageService,
  ) {}

  onModuleInit() {
    this.taskQueueProcessor.registerHandler<EnrichmentRefreshPayload>({
      type: ENRICHMENT_REFRESH_TASK_TYPE,
      execute: async (payload: EnrichmentRefreshPayload) => {
        const locale = payload.locale ?? ''
        const url = typeof payload.url === 'string' ? payload.url : undefined
        try {
          await this.refresh(payload.provider, payload.externalId, locale, {
            url,
          })
        } catch (error) {
          // Record per-row failure so backoff kicks in on subsequent SWR
          // resolves; re-throw so the task queue marks the task failed.
          // Challenge pages are expected anti-bot signals, not infra faults —
          // log at info to keep on-call dashboards clean.
          const logFn =
            error instanceof ChallengeBlockedError
              ? this.logger.log.bind(this.logger)
              : this.logger.warn.bind(this.logger)
          logFn(
            `Enrichment refresh task failed for ${payload.provider}:${payload.externalId} (locale=${locale || '∅'}): ${error.message}`,
          )
          try {
            await this.repository.recordFailure(
              payload.provider,
              payload.externalId,
              error.message,
              locale,
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
    lang?: string,
  ): Promise<{ result: EnrichmentResult; stale?: boolean }> {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    const matched = this.providerRegistry.match(parsedUrl)
    if (!matched) throw new ProviderDisabledError('unknown')

    const { provider, match } = matched
    const reqLocale = resolveRequestedLanguage(lang)
    const cacheLocale = this.resolveCacheLocale(provider, reqLocale)

    const redisHit = await this.getFromRedis(url, cacheLocale)
    if (redisHit) return { result: redisHit }

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
      cacheLocale,
    )
    const now = new Date()

    if (dbRow) {
      const isExpired = !!dbRow.expiresAt && dbRow.expiresAt < now
      const stamped = stampRowId(dbRow.normalized, dbRow.id)

      if (isExpired) {
        const inBackoff = this.isInFailureBackoff(dbRow, now)
        if (!inBackoff) {
          this.enqueueRefresh(provider.name, match.id, cacheLocale)
        }
        return { result: stamped, stale: true }
      }

      await this.setToRedis(url, cacheLocale, stamped)
      return { result: stamped }
    }

    // Locale-aware miss: try the default ('') row as fallback so the user
    // sees something instead of a blank link-card while we backfill.
    if (cacheLocale !== '') {
      const fallback = await this.repository.findByProviderAndExternalId(
        provider.name,
        match.id,
        '',
      )
      if (fallback) {
        this.enqueueRefresh(provider.name, match.id, cacheLocale)
        return {
          result: stampRowId(fallback.normalized, fallback.id),
          stale: true,
        }
      }
    }

    try {
      const result = await this.fetchAndPersist(provider, match.id, {
        url: match.fullUrl,
        subtype: match.subtype,
        locale: cacheLocale,
      })
      await this.setToRedis(url, cacheLocale, result)
      return { result }
    } catch (error) {
      const logFn =
        error instanceof ChallengeBlockedError
          ? this.logger.log.bind(this.logger)
          : this.logger.warn.bind(this.logger)
      logFn(
        `Provider ${provider.name} fetch failed for ${match.id} (locale=${cacheLocale || '∅'}): ${error.message}`,
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

  async getOne(
    providerName: string,
    id: string,
    lang?: string,
  ): Promise<EnrichmentResult> {
    const provider = this.providerRegistry.getByName(providerName)
    if (!provider) throw new Error(`Unknown provider: ${providerName}`)

    const reqLocale = resolveRequestedLanguage(lang)
    const cacheLocale = this.resolveCacheLocale(provider, reqLocale)

    const row = await this.repository.findByProviderAndExternalId(
      providerName,
      id,
      cacheLocale,
    )
    if (row) return stampRowId(row.normalized, row.id)

    return this.fetchAndPersist(provider, id, { locale: cacheLocale })
  }

  async refresh(
    providerName: string,
    id: string,
    lang?: string,
    opts?: { url?: string },
  ): Promise<EnrichmentResult> {
    const provider = this.providerRegistry.getByName(providerName)
    if (!provider) throw new Error(`Unknown provider: ${providerName}`)

    const reqLocale = resolveRequestedLanguage(lang)
    const cacheLocale = this.resolveCacheLocale(provider, reqLocale)

    const result = await this.fetchAndPersist(provider, id, {
      locale: cacheLocale,
      url: opts?.url,
    })
    await this.deleteFromRedis(result.url, cacheLocale)
    return result
  }

  /**
   * Drop cache for a (provider, externalId). When `lang` is omitted, every
   * locale variant of the resource is purged — admin "clear cache" semantics.
   */
  async invalidate(
    providerName: string,
    id: string,
    lang?: string,
  ): Promise<void> {
    if (lang === undefined) {
      const rows = await this.repository.findAllLocalesByRef(providerName, id)
      for (const row of rows) {
        await this.deleteFromRedis(row.url, row.locale)
        // S3 cleanup runs before the cache row is removed — the FK CASCADE
        // would drop the capture row but leave the object behind. Failure
        // is swallowed (see CaptureStorageService.delete contract).
        await this.captureStorage.delete(row.id).catch((error) => {
          this.logger.warn(
            `capture delete failed for ${row.id}: ${(error as Error).message}`,
          )
        })
      }
      await this.repository.deleteByProviderAndExternalId(providerName, id)
      return
    }
    const provider = this.providerRegistry.getByName(providerName)
    const reqLocale = resolveRequestedLanguage(lang)
    const cacheLocale = provider
      ? this.resolveCacheLocale(provider, reqLocale)
      : (reqLocale ?? '')
    const row = await this.repository.findByProviderAndExternalId(
      providerName,
      id,
      cacheLocale,
    )
    if (row) {
      await this.deleteFromRedis(row.url, cacheLocale)
      await this.captureStorage.delete(row.id).catch((error) => {
        this.logger.warn(
          `capture delete failed for ${row.id}: ${(error as Error).message}`,
        )
      })
      await this.repository.deleteByProviderAndExternalId(
        providerName,
        id,
        cacheLocale,
      )
    }
  }

  async list(
    page: number,
    size: number,
    opts?: { onlyFailed?: boolean; locale?: string },
  ) {
    return this.repository.listPaginated(page, size, opts)
  }

  async probe(
    url: string,
    useCache: boolean,
  ): Promise<{
    matched: { provider: string; externalId: string } | null
    result: EnrichmentResult | null
    cached: boolean
    error?: {
      code:
        | 'unknown_provider'
        | 'token_missing'
        | 'provider_disabled'
        | 'fetch_failed'
      message: string
    }
  }> {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return {
        matched: null,
        result: null,
        cached: false,
        error: { code: 'unknown_provider', message: `Invalid URL: ${url}` },
      }
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        matched: null,
        result: null,
        cached: false,
        error: {
          code: 'unknown_provider',
          message: `Unsupported protocol: ${parsedUrl.protocol}`,
        },
      }
    }

    if (useCache) {
      try {
        const { result } = await this.resolve(url)
        return {
          matched: this.matchUrlToRef(url),
          result,
          cached: true,
        }
      } catch (error) {
        if (error instanceof ProviderDisabledError) {
          return {
            matched: this.matchUrlToRef(url),
            result: null,
            cached: false,
            error: {
              code:
                error.providerName === 'unknown'
                  ? 'unknown_provider'
                  : 'provider_disabled',
              message: error.message,
            },
          }
        }
        if (error instanceof TokenMissingError) {
          return {
            matched: this.matchUrlToRef(url),
            result: null,
            cached: false,
            error: { code: 'token_missing', message: error.message },
          }
        }
        return {
          matched: this.matchUrlToRef(url),
          result: null,
          cached: false,
          error: {
            code: 'fetch_failed',
            message: (error as Error).message,
          },
        }
      }
    }

    const matched = this.providerRegistry.match(parsedUrl)
    if (!matched) {
      return {
        matched: null,
        result: null,
        cached: false,
        error: {
          code: 'unknown_provider',
          message: `No provider matched URL: ${url}`,
        },
      }
    }
    const { provider, match } = matched
    const ref = { provider: provider.name, externalId: match.id }

    const config = await this.configsService.get('thirdPartyServiceIntegration')
    if (!this.isProviderEnabled(provider, config)) {
      return {
        matched: ref,
        result: null,
        cached: false,
        error: {
          code: 'provider_disabled',
          message: `Provider disabled: ${provider.name}`,
        },
      }
    }
    if (
      provider.requiredConfigKeys?.length &&
      !this.hasRequiredConfig(provider, config)
    ) {
      return {
        matched: ref,
        result: null,
        cached: false,
        error: {
          code: 'token_missing',
          message: `Token missing for provider: ${provider.name}`,
        },
      }
    }

    try {
      const result = await provider.fetch(match.id, undefined, {
        url: match.fullUrl,
      })
      result.fetchedAt = new Date().toISOString()
      result.category = provider.category
      if (match.subtype) result.subtype = match.subtype
      await this.enrichWithImageMeta(result)
      return { matched: ref, result, cached: false }
    } catch (error) {
      if (error instanceof ProviderDisabledError) {
        return {
          matched: ref,
          result: null,
          cached: false,
          error: { code: 'provider_disabled', message: error.message },
        }
      }
      if (error instanceof TokenMissingError) {
        return {
          matched: ref,
          result: null,
          cached: false,
          error: { code: 'token_missing', message: error.message },
        }
      }
      return {
        matched: ref,
        result: null,
        cached: false,
        error: {
          code: 'fetch_failed',
          message: (error as Error).message,
        },
      }
    }
  }

  /**
   * Bulk (provider, externalId) → cached EnrichmentResult lookup. Core
   * primitive used by both URL-driven hydration (post/note/page link cards)
   * and ref-driven hydration (recently rows that persist provider/externalId
   * directly). Returns any existing row (including expired ones) so SSR
   * hydration matches SWR semantics; for expired non-backoff rows, also
   * enqueues a background refresh. For refs with no cache row at all,
   * enqueues a refresh when the provider is ready — first GET returns empty,
   * subsequent GETs are warm.
   *
   * `lang` selects the cache locale per provider via {@link resolveCacheLocale}.
   * For locale-aware misses, the default (`''`) row is returned as a fallback
   * while a background refresh fills the requested locale.
   *
   * Output is keyed by {@link refKey} (`${provider}\t${externalId}`); callers
   * should index via the same helper.
   */
  async hydrateRefs(
    refs: ReadonlyArray<EnrichmentRefInput>,
    lang?: string,
  ): Promise<Record<string, EnrichmentResult>> {
    if (refs.length === 0) return {}
    const reqLocale = resolveRequestedLanguage(lang)

    interface RefEntry {
      provider: string
      externalId: string
      locale: string
      url?: string
    }
    const byKey = new Map<string, RefEntry>()
    for (const r of refs) {
      const provider = this.providerRegistry.getByName(r.provider)
      const locale = provider
        ? this.resolveCacheLocale(provider, reqLocale)
        : ''
      const key = `${r.provider}\t${r.externalId}\t${locale}`
      const existing = byKey.get(key)
      if (existing) {
        if (!existing.url && r.url) existing.url = r.url
        continue
      }
      byKey.set(key, {
        provider: r.provider,
        externalId: r.externalId,
        locale,
        url: r.url,
      })
    }
    if (byKey.size === 0) return {}

    const refQueries = [...byKey.values()]
    const rows = await this.repository.findManyByRefs(
      refQueries.map(({ provider, externalId, locale }) => ({
        provider,
        externalId,
        locale,
      })),
    )
    const now = new Date()
    const out: Record<string, EnrichmentResult> = {}
    const seenKeys = new Set<string>()
    for (const row of rows) {
      const fullKey = `${row.provider}\t${row.externalId}\t${row.locale}`
      seenKeys.add(fullKey)
      const isExpired = !!row.expiresAt && row.expiresAt < now
      if (isExpired && !this.isInFailureBackoff(row, now)) {
        this.enqueueRefresh(row.provider, row.externalId, row.locale)
      }
      out[refKey(row.provider, row.externalId)] = row.normalized
    }

    // Locale-aware fallback + cold-prefetch for keys that didn't hit.
    const missing = refQueries.filter(
      (e) => !seenKeys.has(`${e.provider}\t${e.externalId}\t${e.locale}`),
    )
    if (missing.length > 0) {
      let config: ThirdPartyConfig | undefined
      const fallbackTargets = missing.filter((e) => e.locale !== '')
      const fallbackRows = fallbackTargets.length
        ? await this.repository.findManyByRefs(
            fallbackTargets.map((e) => ({
              provider: e.provider,
              externalId: e.externalId,
              locale: '',
            })),
          )
        : []
      const fallbackByKey = new Map<string, EnrichmentResult>()
      for (const row of fallbackRows) {
        fallbackByKey.set(refKey(row.provider, row.externalId), row.normalized)
      }
      for (const entry of missing) {
        const provider = this.providerRegistry.getByName(entry.provider)
        if (!provider) continue
        config ??= await this.configsService.get('thirdPartyServiceIntegration')
        if (!this.isProviderReady(provider, config)) continue
        if (provider.requiresUrlContext && !entry.url) continue
        const k = refKey(entry.provider, entry.externalId)
        if (entry.locale !== '' && !out[k]) {
          const fb = fallbackByKey.get(k)
          if (fb) out[k] = fb
        }
        this.enqueueRefresh(
          entry.provider,
          entry.externalId,
          entry.locale,
          entry.url,
        )
      }
    }
    return out
  }

  /**
   * URL-keyed wrapper around {@link hydrateRefs}. Matches each URL to a
   * provider ref, hydrates the deduped ref set in one batch, then re-keys
   * the result by the original URL so post/note/page consumers can index
   * their `enrichments` map directly by URL.
   */
  async hydrateUrls(
    urls: readonly string[],
    lang?: string,
  ): Promise<Record<string, EnrichmentResult>> {
    if (urls.length === 0) return {}
    const unique = [...new Set(urls)]
    const urlRefs: Array<{
      provider: string
      externalId: string
      url: string
    }> = []
    for (const url of unique) {
      const ref = this.matchUrlToRef(url)
      if (!ref) continue
      urlRefs.push({ ...ref, url })
    }
    if (urlRefs.length === 0) return {}

    const refMap = await this.hydrateRefs(
      urlRefs.map((r) => ({
        provider: r.provider,
        externalId: r.externalId,
        url: r.url,
      })),
      lang,
    )
    const out: Record<string, EnrichmentResult> = {}
    for (const r of urlRefs) {
      const result = refMap[refKey(r.provider, r.externalId)]
      if (result && !out[r.url]) out[r.url] = result
    }
    return out
  }

  async prefetchUrls(urls: readonly string[], lang?: string): Promise<void> {
    if (urls.length === 0) return
    const reqLocale = resolveRequestedLanguage(lang)
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
          await this.resolve(url, reqLocale)
        } catch (error) {
          this.logger.warn(`prefetch failed for ${url}: ${error.message}`)
        }
      }),
    )
  }

  /**
   * Schedule a non-blocking prefetch of every link-card URL in the doc.
   * Owned by EnrichmentService so post/note/page services share one hook
   * instead of triplicating the extract→prefetch wiring. Doc-write context
   * carries no request lang, so prefetch warms the default (`''`) row only;
   * other locales are filled lazily by the first reader through SWR.
   */
  scheduleDocPrefetch(doc: ContentDoc): void {
    scheduleManager.schedule(async () => {
      const urls = this.urlExtractor.extractFromDoc(doc)
      if (urls.length === 0) return
      await this.prefetchUrls(urls)
    })
  }

  /**
   * Schedule a non-blocking prefetch of explicit URLs. Used by ref-driven
   * consumers (recently) where the URL is structured metadata rather than
   * extracted from a doc body. Centralizes the fire-and-forget wiring so
   * callers don't reach for `scheduleManager` directly.
   */
  schedulePrefetchUrls(urls: readonly string[]): void {
    if (urls.length === 0) return
    scheduleManager.schedule(async () => {
      await this.prefetchUrls(urls)
    })
  }

  /**
   * Attach a hydrated `enrichments` map to a doc for SSR. Centralized here
   * so post/note/page controllers keep one dependency (this service) and
   * test modules need a single mock instead of two. Pulls the request lang
   * from {@link RequestContext} so every consumer benefits without plumbing.
   */
  async attachEnrichments<T extends ContentDoc>(
    doc: T,
  ): Promise<T & { enrichments: Record<string, EnrichmentResult> }> {
    const urls = this.urlExtractor.extractFromDoc(doc)
    const lang = RequestContext.currentLang()
    const enrichments = urls.length ? await this.hydrateUrls(urls, lang) : {}
    return { ...doc, enrichments }
  }

  /**
   * Map a normalized request locale to the cache locale used for storage and
   * lookup. Single-language providers always use `''`; locale-aware providers
   * use the requested locale only when it appears in their support list.
   */
  resolveCacheLocale(
    provider: EnrichmentProvider,
    reqLocale: string | undefined,
  ): string {
    if (provider.localeAware !== true) return ''
    if (!reqLocale) return ''
    const supported = provider.supportedLocales
    if (supported && !supported.includes(reqLocale)) return ''
    return reqLocale
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
    opts?: { url?: string; subtype?: string; locale?: string },
  ): Promise<EnrichmentResult> {
    const locale = opts?.locale ?? ''
    // Opaque-id providers (open-graph) need the source URL to reconstruct the
    // upstream call. Cold paths supply it via `opts.url`; refresh paths fall
    // back to whatever URL the existing cache row recorded so background
    // refreshes work without re-matching.
    let ctxUrl = opts?.url
    if (!ctxUrl) {
      const existing = await this.repository.findByProviderAndExternalId(
        provider.name,
        externalId,
        locale,
      )
      ctxUrl = existing?.url
    }
    const result = await provider.fetch(
      externalId,
      locale || undefined,
      ctxUrl ? { url: ctxUrl } : undefined,
    )
    result.fetchedAt = new Date().toISOString()
    result.category = provider.category
    if (opts?.subtype) result.subtype = opts.subtype

    await this.enrichWithImageMeta(result)

    const expiresAt = new Date(Date.now() + provider.defaultTtl * 1000)
    const row = await this.repository.upsert(
      provider.name,
      externalId,
      opts?.url ?? result.url,
      result,
      null,
      expiresAt,
      locale,
    )
    result.id = row.id

    await this.processCaptureIfPresent(row.id, result)

    return result
  }

  /**
   * Post-persist capture pipeline. Runs only when the matched provider has
   * stashed raw screenshot bytes via `BrowserFetchService.attachScreenshotBytes`
   * (currently only `OpenGraphProvider` in browser mode). The WeakMap read is
   * the cheapest gate: it returns `undefined` for any provider that did not
   * attach, so we can call this unconditionally without branching by provider.
   *
   * Any failure — pipeline drop, S3 put, DB merge — is logged at `warn` and
   * swallowed. The enrichment response is still returned without
   * `captureImage` and the card degrades gracefully.
   */
  private async processCaptureIfPresent(
    rowId: string,
    result: EnrichmentResult,
  ): Promise<void> {
    const bytes = this.browserFetch.takeScreenshotBytes(result)
    if (!bytes) return

    try {
      const config = await this.configsService.get(
        'thirdPartyServiceIntegration',
      )
      const captureConfig = config.openGraph?.screenshot
      if (!captureConfig?.enabled) return

      const webpQuality = Number(captureConfig.webpQuality ?? 75)
      const maxBytesPerImage = Number(
        captureConfig.maxBytesPerImage ?? 512 * 1024,
      )

      const processed = await this.capturePipeline.process(bytes, {
        webpQuality,
        maxBytesPerImage,
      })
      if (!processed) return

      const stored = await this.captureStorage.storeOrEvict({
        enrichmentId: rowId,
        processed,
      })

      const captureImage = {
        url: stored.url,
        width: processed.width,
        height: processed.height,
        thumbhash: processed.thumbhash,
        palette: processed.palette,
      }
      result.captureImage = captureImage
      await this.repository.updateCapture(rowId, captureImage)
    } catch (error) {
      this.logger.warn(
        `capture post-persist failed for ${result.url} (rowId=${rowId}): ${
          (error as Error).message
        }`,
      )
    }
  }

  /**
   * Best-effort enrichment of an EnrichmentResult with image-derived metadata
   * (dominant accent color, thumbhash, dimensions). Mutates `result` in place.
   * Skipped when no thumbnailImage URL is set or when `color` is already
   * populated (preserves provider-specific writes such as github-repo's
   * language name).
   */
  private async enrichWithImageMeta(result: EnrichmentResult): Promise<void> {
    if (!result.thumbnailImage?.url) return
    if (result.color) return

    try {
      const { size, accent, thumbhash } =
        await this.imageService.getOnlineImageSizeAndMeta(
          result.thumbnailImage.url,
        )
      result.color = accent
      result.thumbnailImage.thumbhash = thumbhash
      if (size.width != null) result.thumbnailImage.width = size.width
      if (size.height != null) result.thumbnailImage.height = size.height
    } catch (error) {
      this.logger.warn(
        `Image meta extraction failed for ${result.url}: ${error.message}`,
      )
      // swallow — color/thumbhash/size are optional fields
    }
  }

  private enqueueRefresh(
    providerName: string,
    externalId: string,
    locale: string,
    url?: string,
  ): void {
    const dedupKey = locale
      ? `${providerName}:${externalId}:${locale}`
      : `${providerName}:${externalId}`
    void this.taskQueueService
      .createTask({
        type: ENRICHMENT_REFRESH_TASK_TYPE,
        scope: ENRICHMENT_TASK_SCOPE,
        dedupKey,
        payload: {
          provider: providerName,
          externalId,
          locale,
          ...(url ? { url } : {}),
        } satisfies EnrichmentRefreshPayload,
      })
      .catch((error) => {
        this.logger.warn(
          `Failed to enqueue enrichment refresh for ${providerName}:${externalId} (locale=${locale || '∅'}): ${error.message}`,
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

  private async getFromRedis(
    url: string,
    locale: string,
  ): Promise<EnrichmentResult | null> {
    const client = this.redisService.getClient()
    const cached = await client.get(this.redisKey(url, locale))
    if (!cached) return null
    try {
      return JSON.parse(cached) as EnrichmentResult
    } catch {
      return null
    }
  }

  private async setToRedis(
    url: string,
    locale: string,
    result: EnrichmentResult,
  ): Promise<void> {
    const client = this.redisService.getClient()
    await client.set(
      this.redisKey(url, locale),
      JSON.stringify(result),
      'EX',
      REDIS_TTL,
    )
  }

  private async deleteFromRedis(url: string, locale: string): Promise<void> {
    const client = this.redisService.getClient()
    await client.del(this.redisKey(url, locale))
  }

  private redisKey(url: string, locale: string): string {
    const hash = createHash('sha1').update(url).digest('hex')
    return `${REDIS_KEY_PREFIX}${hash}:${locale}`
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

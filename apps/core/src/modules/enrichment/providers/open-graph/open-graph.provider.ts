import { createHash } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type {
  EnrichmentFetchContext,
  EnrichmentProvider,
} from '../provider.interface'
import { BrowserFetchService } from './browser-fetch.service'
import { enrichWithOEmbed } from './oembed'
import { parseOpenGraph } from './og-parser'
import { safeFetch, type SafeFetchResult } from './safe-fetch'

const DEFAULT_FETCH_TIMEOUT_MS = 8_000
const DEFAULT_BROWSER_TIMEOUT_MS = 25_000
const DEFAULT_MAX_BODY_BYTES = 524_288
const ID_HEX_LENGTH = 32

/**
 * Bottom-of-the-stack fallback provider. Matches any well-formed http(s) URL
 * with the lowest priority so all domain-specific providers (TMDB, GitHub,
 * etc.) win first. When no specialized provider claims a link, this one
 * fetches the page, extracts Open Graph / Twitter Card / standard head meta
 * via linkedom, and (when discoverable) supplements via oEmbed alternate.
 *
 * `externalId` is a sha256-hashed normalized URL (origin + pathname + search,
 * fragment dropped) capped at 32 hex chars. The full URL is stored in the
 * `url` column so refresh paths can reconstruct the upstream call without
 * needing to re-derive the URL from the id.
 */
@Injectable()
export class OpenGraphProvider implements EnrichmentProvider {
  readonly name = 'open-graph'
  readonly displayName = 'Open Graph'
  readonly category = ENRICHMENT_CATEGORIES.WEB
  // Below every domain-specific provider. Registry sorts desc, so this
  // is consulted only after every targeted matcher has declined.
  readonly priority = -100
  readonly defaultTtl = 86_400 * 7
  readonly featureGateConfigKey = 'openGraph'
  readonly requiresUrlContext = true

  private readonly logger = new Logger(OpenGraphProvider.name)

  constructor(
    private readonly configsService: ConfigsService,
    private readonly browserFetch: BrowserFetchService,
  ) {}

  matchUrl(url: URL): UrlMatchResult | null {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname) return null
    const normalized = `${url.origin}${url.pathname}${url.search}`
    return {
      id: hashUrlToId(normalized),
      fullUrl: normalized,
    }
  }

  isValidId(id: string): boolean {
    return new RegExp(`^[\\da-f]{${ID_HEX_LENGTH}}$`).test(id)
  }

  async fetch(
    _id: string,
    _locale?: string,
    ctx?: EnrichmentFetchContext,
  ): Promise<EnrichmentResult> {
    const url = ctx?.url
    if (!url) {
      // refresh on a row whose URL was deleted, or admin getOne for an unseen
      // id. There is no way to fetch without the URL — surface a clear error.
      throw new Error(
        'open-graph provider requires a URL context (no cached URL available)',
      )
    }

    const config = await this.configsService.get('thirdPartyServiceIntegration')
    const og = config.openGraph ?? {}
    const fetchMode = og.fetchMode ?? 'fetch'
    const maxBodyBytes = og.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
    const defaultTimeout =
      fetchMode === 'browser'
        ? DEFAULT_BROWSER_TIMEOUT_MS
        : DEFAULT_FETCH_TIMEOUT_MS
    const timeoutMs = og.timeoutMs ?? defaultTimeout

    // Browser mode runs `fetchPage` (HTML + optional screenshot bytes in one
    // session). HTTP mode stays on `safeFetch` — no Chromium spin-up, and
    // screenshots are out of scope on that path (see spec Non-Goals). Note
    // these are NOT fallbacks for each other: a `browser`-mode fetch failure
    // throws, it does not silently downgrade to HTTP.
    let safe: SafeFetchResult
    let screenshotBytes: Buffer | undefined
    if (fetchMode === 'browser') {
      const captureScreenshot = og.screenshot?.enabled === true
      const fetched = await this.browserFetch.fetchPage(url, {
        timeoutMs,
        maxBodyBytes,
        captureScreenshot,
      })
      safe = fetched.html
      screenshotBytes = fetched.screenshotBytes
    } else {
      safe = await safeFetch(url, { timeoutMs, maxBodyBytes })
    }

    const { result, oembedUrl } = parseOpenGraph(safe.body, safe.finalUrl, url)

    // oEmbed alternates are always plain JSON — keep them on the HTTP path
    // even in browser mode (cheap, no Chromium spin-up).
    if (oembedUrl) {
      try {
        await enrichWithOEmbed(result, oembedUrl, {
          timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
          maxBodyBytes,
        })
      } catch (error) {
        this.logger.debug(
          `oEmbed enrichment skipped for ${url}: ${(error as Error).message}`,
        )
      }
    }

    // Force category — defensive in case parseOpenGraph drift forgets it.
    result.category = this.category

    // Hand raw screenshot bytes to `EnrichmentService` via the BrowserFetch
    // WeakMap channel. `EnrichmentService.fetchAndPersist` reads them after
    // the row is persisted (it needs the row id before writing the
    // screenshot row). The public return type stays unchanged — `screenshot`
    // is attached AFTER persistence, not by the provider.
    if (screenshotBytes) {
      this.browserFetch.attachScreenshotBytes(result, screenshotBytes)
    }

    return result
  }
}

function hashUrlToId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, ID_HEX_LENGTH)
}

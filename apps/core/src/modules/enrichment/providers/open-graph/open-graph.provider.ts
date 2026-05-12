import { createHash } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { ConfigsService } from '~/modules/configs/configs.service'

import type { EnrichmentResult, UrlMatchResult } from '../../enrichment.types'
import { ENRICHMENT_CATEGORIES } from '../provider.constants'
import type {
  EnrichmentFetchContext,
  EnrichmentProvider,
} from '../provider.interface'
import { enrichWithOEmbed } from './oembed'
import { parseOpenGraph } from './og-parser'
import { safeFetch } from './safe-fetch'

const DEFAULT_TIMEOUT_MS = 8_000
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

  constructor(private readonly configsService: ConfigsService) {}

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
    const timeoutMs = og.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxBodyBytes = og.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES

    const fetched = await safeFetch(url, { timeoutMs, maxBodyBytes })
    const { result, oembedUrl } = parseOpenGraph(
      fetched.body,
      fetched.finalUrl,
      url,
    )

    if (oembedUrl) {
      try {
        await enrichWithOEmbed(result, oembedUrl, { timeoutMs, maxBodyBytes })
      } catch (error) {
        this.logger.debug(
          `oEmbed enrichment skipped for ${url}: ${(error as Error).message}`,
        )
      }
    }

    // Force category — defensive in case parseOpenGraph drift forgets it.
    result.category = this.category
    return result
  }
}

function hashUrlToId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, ID_HEX_LENGTH)
}

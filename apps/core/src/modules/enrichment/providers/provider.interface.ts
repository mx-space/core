import type { EnrichmentResult, UrlMatchResult } from '../enrichment.types'

export const ENRICHMENT_PROVIDER_TOKEN = Symbol('ENRICHMENT_PROVIDER')

/**
 * Side-channel passed to {@link EnrichmentProvider.fetch}. Providers whose
 * `externalId` already encodes the request (TMDB id, GitHub repo, etc.) can
 * ignore this entirely. Providers whose id is opaque (e.g. a hash of the
 * source URL) need {@link url} to reconstruct the upstream call.
 */
export interface EnrichmentFetchContext {
  /**
   * Source URL the user originally pasted, after registry-side normalization.
   * Available on cold paths (resolve) and on refresh paths where a cached row
   * exists; absent only when an admin force-fetches an unseen externalId.
   */
  url?: string
}

export interface EnrichmentProvider<TRaw = unknown> {
  readonly name: string
  readonly displayName: string
  readonly category: string
  readonly priority: number
  readonly defaultTtl: number

  matchUrl: (url: URL) => UrlMatchResult | null
  isValidId: (id: string) => boolean
  /**
   * Fetch normalized enrichment data. `locale` is a normalized ISO-639-1 code
   * (`zh`, `ja`, `ko`, `en`). Providers with `localeAware !== true` MUST ignore
   * this argument; the service layer guarantees only `''`-equivalent values
   * reach those providers, but defensive implementations should not branch on
   * it. `ctx.url` is supplied for opaque-id providers (Open Graph fallback);
   * other providers may safely ignore it.
   */
  fetch: (
    id: string,
    locale?: string,
    ctx?: EnrichmentFetchContext,
  ) => Promise<EnrichmentResult<TRaw>>

  readonly requiredConfigKeys?: string[]
  readonly featureGateConfigKey?: string
  /**
   * True when `externalId` alone is not enough to fetch upstream data.
   * Ref-driven cold hydration must provide `ctx.url` for these providers.
   */
  readonly requiresUrlContext?: boolean
  /**
   * When true, the service layer maps the request `lang` into a per-locale
   * cache row and passes it to {@link fetch}. Default false.
   */
  readonly localeAware?: boolean
  /**
   * Locales that {@link fetch} can serve when {@link localeAware} is true.
   * Requested locales outside this list fall back to the default (`''`) row.
   */
  readonly supportedLocales?: readonly string[]
}

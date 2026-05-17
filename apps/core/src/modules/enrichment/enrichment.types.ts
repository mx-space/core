export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  blurhash?: string
}

export interface EnrichmentAttribute {
  key: string
  value: string | number | boolean
  label?: string
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}

export interface EnrichmentScreenshotPalette {
  dominant: string
  swatches?: string[]
}

export interface EnrichmentScreenshot {
  url: string
  width: number
  height: number
  blurhash?: string
  palette?: EnrichmentScreenshotPalette
}

export interface EnrichmentResult<TRaw = unknown> {
  /**
   * Cache row Snowflake id. Populated by `EnrichmentService` on cache hit
   * and post-persist paths so consumers (notably the screenshot LRU touch
   * path) can address the underlying row without re-querying. Absent on
   * raw provider returns and on results fresh out of the cold provider
   * fetch before persistence.
   */
  id?: string

  title: string
  description?: string
  image?: EnrichmentImage
  url: string

  category: string
  subtype?: string

  publishedAt?: string
  fetchedAt: string

  attributes?: EnrichmentAttribute[]

  color?: string

  links?: Array<{ rel: string; url: string; label?: string }>

  /**
   * Optional browser-mode page screenshot. Populated by `EnrichmentService`
   * after the row is persisted (only when `screenshot.enabled` is set and
   * the provider captured raw bytes via `BrowserFetchService.fetchPage`).
   * Purely additive — consumers that ignore it see no behavioral change.
   */
  screenshot?: EnrichmentScreenshot

  raw?: TRaw
}

export interface EnrichmentRow {
  id: string
  provider: string
  externalId: string
  url: string
  /**
   * Cache locale tag. `''` denotes "default / locale-unaware" — used for both
   * single-language providers and the fallback row of locale-aware providers.
   * Non-empty values are normalized 2-letter codes (`zh`, `ja`, `ko`, `en`).
   */
  locale: string
  normalized: EnrichmentResult
  raw: unknown | null
  fetchedAt: Date
  expiresAt: Date | null
  failureCount: number
  lastError: string | null
  createdAt: Date
}

export interface UrlMatchResult {
  id: string
  fullUrl: string
  subtype?: string
}

export interface ProviderMeta {
  name: string
  displayName: string
  category: string
  /** Section under `thirdPartyServiceIntegration` is enabled (or unscoped). */
  enabled: boolean
  /** All gating + credential checks pass; provider can resolve right now. */
  ready: boolean
  /**
   * Required config paths (relative to {@link featureGateConfigKey} section)
   * that are currently empty. Empty array when the provider has no required
   * credentials. Sent to the dashboard so it can render an actionable hint.
   */
  missingKeys: string[]
  /** Names of config paths that gate this provider's credentials. */
  requiredConfigKeys?: string[]
  /** Top-level section under `thirdPartyServiceIntegration` (e.g. `tmdb`). */
  featureGateConfigKey?: string
  /** Whether this provider fetches per-locale variants (e.g. TMDB). */
  localeAware: boolean
  /** ISO-639-1 codes the provider can localize into (only when localeAware). */
  supportedLocales?: readonly string[]
}

export class TokenMissingError extends Error {
  constructor(public readonly providerName: string) {
    super(`Token missing for provider: ${providerName}`)
    this.name = 'TokenMissingError'
  }
}

export class ProviderDisabledError extends Error {
  constructor(public readonly providerName: string) {
    super(`Provider disabled: ${providerName}`)
    this.name = 'ProviderDisabledError'
  }
}

export class ChallengeBlockedError extends Error {
  readonly code = 'challenge_blocked' as const
  constructor(
    public readonly url: string,
    public readonly signature: string,
  ) {
    super(`challenge page detected for ${url} (signature: "${signature}")`)
    this.name = 'ChallengeBlockedError'
  }
}

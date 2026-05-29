export interface LegacyPager {
  total: number
  size: number
  currentPage: number
  totalPage: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface EnrichmentImagePalette {
  dominant: string
  swatches?: string[]
}

export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  thumbhash?: string
  palette?: EnrichmentImagePalette
}

export interface EnrichmentAttribute {
  key: string
  value: string | number | boolean
  label?: string
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}

export interface EnrichmentResult {
  id?: string
  title: string
  description?: string
  thumbnailImage?: EnrichmentImage
  previewImage?: EnrichmentImage
  url: string
  category: string
  subtype?: string
  publishedAt?: string
  fetchedAt: string
  attributes?: EnrichmentAttribute[]
  color?: string
  links?: Array<{ rel: string; url: string; label?: string }>
  captureImage?: EnrichmentImage
}

export interface EnrichmentRow {
  id: string
  provider: string
  externalId: string
  url: string
  /**
   * Cache locale tag. `''` denotes the default / locale-unaware row used by
   * single-language providers and as the fallback row of locale-aware ones.
   * Non-empty values are normalized 2-letter codes (`zh`, `ja`, `ko`, `en`).
   */
  locale: string
  normalized: EnrichmentResult
  raw: unknown | null
  fetchedAt: string
  expiresAt: string | null
  failureCount: number
  lastError: string | null
  createdAt: string
}

export interface EnrichmentListResponse {
  data: EnrichmentRow[]
  pagination: LegacyPager
}

export interface EnrichmentCaptureRow {
  enrichmentId: string
  objectKey: string
  bytes: number
  width: number
  height: number
  thumbhash: string | null
  palette: EnrichmentImagePalette | null
  createdAt: string
  lastAccessedAt: string
}

export interface EnrichmentCaptureJoinedRow extends EnrichmentCaptureRow {
  provider: string
  externalId: string
  url: string
  title: string
  publicUrl: string
}

export interface EnrichmentCaptureListResponse {
  data: EnrichmentCaptureJoinedRow[]
  pagination: LegacyPager
}

export interface EnrichmentCaptureQuota {
  used: { count: number; totalBytes: number }
  cap: { maxItems: number; maxTotalBytes: number }
  enabled: boolean
  fetchMode: 'fetch' | 'browser'
}

export interface EnrichmentRowDetail extends EnrichmentRow {
  capture: EnrichmentCaptureRow | null
}

export type EnrichmentProbeErrorCode =
  | 'unknown_provider'
  | 'token_missing'
  | 'provider_disabled'
  | 'fetch_failed'

export interface EnrichmentProbeResult {
  matched: { provider: string; externalId: string } | null
  result: EnrichmentResult | null
  cached: boolean
  error?: { code: EnrichmentProbeErrorCode; message: string }
}

export interface EnrichmentProviderMeta {
  name: string
  displayName: string
  category: string
  /** Section under `thirdPartyServiceIntegration` is enabled (or unscoped). */
  enabled: boolean
  /** Server confirms this provider can resolve right now (enabled + creds). */
  ready: boolean
  /** Required config keys (relative to gate section) that are empty. */
  missingKeys: string[]
  requiredConfigKeys?: string[]
  featureGateConfigKey?: string
  /** Whether this provider fetches per-locale variants (e.g. TMDB). */
  localeAware: boolean
  /** ISO-639-1 codes the provider can localize into (only when localeAware). */
  supportedLocales?: readonly string[]
}

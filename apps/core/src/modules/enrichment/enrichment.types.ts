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

export interface EnrichmentResult<TRaw = unknown> {
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

  raw?: TRaw
}

export interface EnrichmentRow {
  id: string
  provider: string
  externalId: string
  url: string
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
  enabled: boolean
  requiredConfigKeys?: string[]
  featureGateConfigKey?: string
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

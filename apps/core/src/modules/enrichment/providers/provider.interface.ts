import type { EnrichmentResult, UrlMatchResult } from '../enrichment.types'

export const ENRICHMENT_PROVIDER_TOKEN = Symbol('ENRICHMENT_PROVIDER')

export interface EnrichmentProvider<TRaw = unknown> {
  readonly name: string
  readonly displayName: string
  readonly category: string
  readonly priority: number
  readonly defaultTtl: number

  matchUrl(url: URL): UrlMatchResult | null
  isValidId(id: string): boolean
  fetch(id: string): Promise<EnrichmentResult<TRaw>>

  readonly requiredConfigKeys?: string[]
  readonly featureGateConfigKey?: string
}

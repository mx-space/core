import type { EnrichmentResult, UrlMatchResult } from '../enrichment.types'

export const ENRICHMENT_PROVIDER_TOKEN = Symbol('ENRICHMENT_PROVIDER')

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
   * it.
   */
  fetch: (id: string, locale?: string) => Promise<EnrichmentResult<TRaw>>

  readonly requiredConfigKeys?: string[]
  readonly featureGateConfigKey?: string
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

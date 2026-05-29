import type { EnrichmentResult } from '~/models/enrichment'

export interface UrlPreviewState {
  error: string | null
  loading: boolean
  result: EnrichmentResult | null
}

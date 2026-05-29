import type { EnrichmentProbeResult } from '~/models/enrichment'

export type EnrichmentSource = 'cache' | 'probe' | 'screenshots'

export type CacheFilterMode = 'all' | 'failed'

export type CaptureSortField = 'bytes' | 'created' | 'last_accessed'

export type SortOrder = 'asc' | 'desc'

export interface ProbeHistoryEntry {
  createdAt: number
  id: string
  result: EnrichmentProbeResult
  url: string
}

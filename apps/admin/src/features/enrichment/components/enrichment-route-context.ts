import { createContext, useContext } from 'react'

import type {
  EnrichmentCaptureJoinedRow,
  EnrichmentCaptureQuota,
  EnrichmentRow,
} from '~/models/enrichment'

import type { EnrichmentSource, ProbeHistoryEntry } from '../types/enrichment'

export interface EnrichmentRouteContextValue {
  source: EnrichmentSource
  cacheRows: EnrichmentRow[]
  captureRows: EnrichmentCaptureJoinedRow[]
  quota: EnrichmentCaptureQuota | null
  probeHistory: ProbeHistoryEntry[]
  selectedProbeId: string | null
  onSelectProbe: (id: string | null) => void
  onPushProbeEntry: (entry: ProbeHistoryEntry) => void
  onBack: () => void
  onJumpToScreenshot: (enrichmentId: string) => void
  onCaptureDeleted: (enrichmentId: string) => void
  invalidateAll: () => Promise<void>
}

export const EnrichmentRouteContext =
  createContext<EnrichmentRouteContextValue | null>(null)

export function useEnrichmentRouteContext(): EnrichmentRouteContextValue {
  const ctx = useContext(EnrichmentRouteContext)
  if (!ctx) {
    throw new Error(
      'useEnrichmentRouteContext must be used inside <EnrichmentRouteContext.Provider>',
    )
  }
  return ctx
}

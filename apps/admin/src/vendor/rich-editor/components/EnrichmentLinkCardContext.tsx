import { createContext, useContext } from 'react'
import type { EnrichmentResult } from '../types'

export type EnrichmentFetcher = (
  url: string,
) => Promise<EnrichmentResult | null>

const EnrichmentFetcherContext = createContext<EnrichmentFetcher | null>(null)

export const EnrichmentFetcherProvider = EnrichmentFetcherContext.Provider

export function useEnrichmentFetcher(): EnrichmentFetcher | null {
  return useContext(EnrichmentFetcherContext)
}

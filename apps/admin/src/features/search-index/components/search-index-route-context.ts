import { createContext, useContext } from 'react'

import type { SearchDocumentAdminRow } from '~/api/search-index'

export interface SearchIndexRouteContextValue {
  onBack: () => void
  onRebuild: (row: SearchDocumentAdminRow) => void
  isRebuilding: (id: string) => boolean
}

export const SearchIndexRouteContext =
  createContext<SearchIndexRouteContextValue | null>(null)

export function useSearchIndexRouteContext(): SearchIndexRouteContextValue {
  const ctx = useContext(SearchIndexRouteContext)
  if (!ctx) {
    throw new Error(
      'useSearchIndexRouteContext must be used inside <SearchIndexRouteContext.Provider>',
    )
  }
  return ctx
}

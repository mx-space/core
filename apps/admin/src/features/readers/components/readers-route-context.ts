import { createContext, useContext } from 'react'

import type { useReaderMutations } from '../hooks/useReaderMutations'

export interface ReadersRouteContextValue {
  currentUserId: string | null
  mutations: ReturnType<typeof useReaderMutations>
  onBack: () => void
}

export const ReadersRouteContext =
  createContext<ReadersRouteContextValue | null>(null)

export function useReadersRouteContext(): ReadersRouteContextValue {
  const ctx = useContext(ReadersRouteContext)
  if (!ctx) {
    throw new Error(
      'useReadersRouteContext must be used inside <ReadersRouteContext.Provider>',
    )
  }
  return ctx
}

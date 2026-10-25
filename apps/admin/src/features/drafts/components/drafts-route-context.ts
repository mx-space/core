import { createContext, useContext } from 'react'

import type { DraftCard } from '~/models/draft'

export interface DraftsRouteContextValue {
  busy: boolean
  onBack: () => void
  onCompact: (draft: DraftCard) => void
  onDelete: (draft: DraftCard) => void
}

export const DraftsRouteContext = createContext<DraftsRouteContextValue | null>(
  null,
)

export function useDraftsRouteContext(): DraftsRouteContextValue {
  const ctx = useContext(DraftsRouteContext)
  if (!ctx) {
    throw new Error(
      'useDraftsRouteContext must be used inside <DraftsRouteContext.Provider>',
    )
  }
  return ctx
}

import { createContext, useContext } from 'react'

import type { DraftModel } from '~/models/draft'

export interface DraftsRouteContextValue {
  deleting: boolean
  onBack: () => void
  onDelete: (draft: DraftModel) => void
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

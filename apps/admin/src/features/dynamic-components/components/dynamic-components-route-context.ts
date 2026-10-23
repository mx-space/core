import { createContext, useContext } from 'react'

import type { DynamicComponentItem } from '../types/dynamic-components'

export interface DynamicComponentsRouteContextValue {
  onBack: () => void
  onDelete: (item: DynamicComponentItem) => void
  onEdit: (item: DynamicComponentItem) => void
}

export const DynamicComponentsRouteContext =
  createContext<DynamicComponentsRouteContextValue | null>(null)

export function useDynamicComponentsRouteContext(): DynamicComponentsRouteContextValue {
  const ctx = useContext(DynamicComponentsRouteContext)
  if (!ctx) {
    throw new Error(
      'useDynamicComponentsRouteContext must be used inside <DynamicComponentsRouteContext.Provider>',
    )
  }
  return ctx
}

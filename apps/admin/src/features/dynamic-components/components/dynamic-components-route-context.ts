import { createContext, useContext } from 'react'

import type { DynamicComponentItem } from '../types/dynamic-components'
import type {
  ComponentCleanupCandidate,
  ComponentUsageReport,
} from '../utils/component-usage'

export interface DynamicComponentsRouteContextValue {
  deletingKey: null | string
  onBack: () => void
  onDelete: (item: DynamicComponentItem) => void
  onDeleteCandidate: (candidate: ComponentCleanupCandidate) => void
  onEdit: (item: DynamicComponentItem) => void
  usage: ComponentUsageReport | undefined
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

import { createContext, useContext } from 'react'

import type { CategoryEntity } from '~/data/resources/category'

export interface CategoriesRouteContextValue {
  deleting: boolean
  onBack: () => void
  onDelete: (category: CategoryEntity) => void
  onEdit: (category: CategoryEntity) => void
}

export const CategoriesRouteContext =
  createContext<CategoriesRouteContextValue | null>(null)

export function useCategoriesRouteContext(): CategoriesRouteContextValue {
  const ctx = useContext(CategoriesRouteContext)
  if (!ctx) {
    throw new Error(
      'useCategoriesRouteContext must be used inside <CategoriesRouteContext.Provider>',
    )
  }
  return ctx
}

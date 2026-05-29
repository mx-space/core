import { createContext, useContext } from 'react'

import type { OrphanFile } from '~/api/files'

import type { FileRowItem } from '../utils/adapters'

export interface OrphanFilesRouteContextValue {
  page: number
  deleteDisabled: boolean
  onBack: () => void
  onDelete: (item: FileRowItem<OrphanFile>) => void
  onOpenPreview: (preview: { name: string; url: string }) => void
}

export const OrphanFilesRouteContext =
  createContext<OrphanFilesRouteContextValue | null>(null)

export function useOrphanFilesRouteContext(): OrphanFilesRouteContextValue {
  const ctx = useContext(OrphanFilesRouteContext)
  if (!ctx) {
    throw new Error(
      'useOrphanFilesRouteContext must be used inside <OrphanFilesRouteContext.Provider>',
    )
  }
  return ctx
}

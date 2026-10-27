import { createContext, useContext } from 'react'

import type { RemoteFile } from '~/api/files'

import type { FileRowItem } from '../utils/adapters'

export interface RemoteFilesRouteContextValue {
  deleteDisabled: boolean
  onBack: () => void
  onDelete: (item: FileRowItem<RemoteFile>) => void
  onOpenPreview: (preview: { name: string; url: string }) => void
}

export const RemoteFilesRouteContext =
  createContext<RemoteFilesRouteContextValue | null>(null)

export function useRemoteFilesRouteContext(): RemoteFilesRouteContextValue {
  const ctx = useContext(RemoteFilesRouteContext)
  if (!ctx) {
    throw new Error(
      'useRemoteFilesRouteContext must be used inside <RemoteFilesRouteContext.Provider>',
    )
  }
  return ctx
}

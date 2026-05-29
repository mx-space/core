import { createContext, useContext } from 'react'

import type { BackupFile } from '~/api/backups'

export interface BackupRouteContextValue {
  onBack: () => void
  onDelete: (item: BackupFile) => void
  onDownload: (item: BackupFile) => void
  onRollback: (item: BackupFile) => void
}

export const BackupRouteContext = createContext<BackupRouteContextValue | null>(
  null,
)

export function useBackupRouteContext(): BackupRouteContextValue {
  const ctx = useContext(BackupRouteContext)
  if (!ctx) {
    throw new Error(
      'useBackupRouteContext must be used inside <BackupRouteContext.Provider>',
    )
  }
  return ctx
}

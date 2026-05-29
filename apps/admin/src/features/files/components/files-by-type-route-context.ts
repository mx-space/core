import { createContext, useContext } from 'react'

import type { FileItem, FileType } from '~/api/files'

import type { FileRowItem } from '../utils/adapters'

export interface FilesByTypeRouteContextValue {
  fileType: FileType
  typeLabel: string
  deleteDisabled: boolean
  onBack: () => void
  onDelete: (item: FileRowItem<FileItem>) => void
  onOpenPreview: (preview: { name: string; url: string }) => void
  onDimensions: (dim: { width: number; height: number }) => void
  naturalSize: { width: number; height: number } | null
}

export const FilesByTypeRouteContext =
  createContext<FilesByTypeRouteContextValue | null>(null)

export function useFilesByTypeRouteContext(): FilesByTypeRouteContextValue {
  const ctx = useContext(FilesByTypeRouteContext)
  if (!ctx) {
    throw new Error(
      'useFilesByTypeRouteContext must be used inside <FilesByTypeRouteContext.Provider>',
    )
  }
  return ctx
}

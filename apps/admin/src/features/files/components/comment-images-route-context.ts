import { createContext, useContext } from 'react'

import type { CommentUploadFile, CommentUploadStatus } from '~/api/files'

import type { FileRowItem } from '../utils/adapters'

export interface CommentImagesRouteContextValue {
  status: CommentUploadStatus
  page: number
  statusLabels: Record<Exclude<CommentUploadStatus, ''>, string>
  deleteDisabled: boolean
  onBack: () => void
  onDelete: (item: FileRowItem<CommentUploadFile>) => void
  onOpenPreview: (preview: { name: string; url: string }) => void
}

export const CommentImagesRouteContext =
  createContext<CommentImagesRouteContextValue | null>(null)

export function useCommentImagesRouteContext(): CommentImagesRouteContextValue {
  const ctx = useContext(CommentImagesRouteContext)
  if (!ctx) {
    throw new Error(
      'useCommentImagesRouteContext must be used inside <CommentImagesRouteContext.Provider>',
    )
  }
  return ctx
}

import { createContext, useContext } from 'react'

import type { CommentModel, CommentState } from '~/models/comment'

export interface CommentsRouteContextValue {
  currentState: CommentState
  replyPending: boolean
  onBack: () => void
  onDelete: (comment: CommentModel) => void
  onReply: (id: string, text: string) => Promise<unknown>
  onStateChange: (id: string, state: CommentState) => void
}

export const CommentsRouteContext =
  createContext<CommentsRouteContextValue | null>(null)

export function useCommentsRouteContext(): CommentsRouteContextValue {
  const ctx = useContext(CommentsRouteContext)
  if (!ctx) {
    throw new Error(
      'useCommentsRouteContext must be used inside <CommentsRouteContext.Provider>',
    )
  }
  return ctx
}

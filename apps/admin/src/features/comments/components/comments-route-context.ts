import { createContext, useContext } from 'react'

import type { CommentListState } from '~/api/comments'
import type { CommentModel, CommentState } from '~/models/comment'

export interface CommentsRouteContextValue {
  currentState: CommentListState
  replyPending: boolean
  onBack: () => void
  onDelete: (comment: CommentModel) => void
  onReply: (id: string, text: string) => Promise<CommentModel>
  onStateChange: (id: string, state: CommentState) => void
  /**
   * Register a callback that focuses the reply composer. The list route uses
   * this to wire the `r` keyboard shortcut without coupling the orchestrator
   * to the detail tree.
   */
  registerComposerFocus: (handler: (() => void) | null) => void
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

/** Like `useCommentsRouteContext` but returns null when no provider exists. */
export function useOptionalCommentsRouteContext(): CommentsRouteContextValue | null {
  return useContext(CommentsRouteContext)
}

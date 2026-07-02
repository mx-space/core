import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import {
  batchDeleteComments,
  batchUpdateCommentState,
  type CommentListState,
  type CommentRefType,
  deleteComment,
  replyComment,
  updateCommentState,
} from '~/api/comments'
import { useI18n } from '~/i18n'
import type { CommentModel, CommentsResponse } from '~/models/comment'
import { CommentState } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

import { commentsQueryKey } from '../constants'

interface UseCommentMutationsOptions {
  getSelectedTargets: () => CommentModel[]
  onAfterBatchSuccess?: () => void
  onAfterDeleteSuccess?: () => void
  refId?: string
  refType?: CommentRefType
  search?: string
  selectAllMode: boolean
  state: CommentListState
}

export function useCommentMutations(options: UseCommentMutationsOptions) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateComments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: commentsQueryKey })
  }, [queryClient])

  const stateMutation = useMutation({
    mutationFn: ({ id, nextState }: { id: string; nextState: CommentState }) =>
      updateCommentState(id, nextState),
    onSuccess: async () => {
      toast.success(t('comments.toast.updated'))
      await invalidateComments()
    },
  })

  // Marking read on open must not disturb the list the user is scanning:
  // patch the cached rows in place instead of invalidating, so the row stays
  // visible in the unread tab until the next natural refetch. No toast.
  const markReadOnOpenMutation = useMutation({
    mutationFn: (id: string) => updateCommentState(id, CommentState.Read),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<CommentsResponse>(
        { queryKey: adminQueryKeys.comments.listRoot },
        (cached) =>
          cached && {
            ...cached,
            data: cached.data.map((comment) =>
              comment.id === id
                ? { ...comment, state: CommentState.Read }
                : comment,
            ),
          },
      )
      void queryClient.invalidateQueries({
        queryKey: adminQueryKeys.comments.tabCountsRoot,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: async () => {
      toast.success(t('comments.toast.deleted'))
      options.onAfterDeleteSuccess?.()
      await invalidateComments()
    },
  })

  const batchStateMutation = useMutation({
    mutationFn: (nextState: CommentState) => {
      if (options.selectAllMode) {
        return batchUpdateCommentState({
          all: true,
          currentState:
            typeof options.state === 'number' ? options.state : undefined,
          refId: options.refId,
          refType: options.refType,
          search: options.search,
          state: nextState,
        })
      }

      return batchUpdateCommentState({
        ids: options.getSelectedTargets().map((comment) => comment.id),
        state: nextState,
      })
    },
    onSuccess: async () => {
      toast.success(t('comments.toast.updated'))
      options.onAfterBatchSuccess?.()
      await invalidateComments()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: () => {
      if (options.selectAllMode) {
        return batchDeleteComments({
          all: true,
          refId: options.refId,
          refType: options.refType,
          search: options.search,
          state: typeof options.state === 'number' ? options.state : undefined,
        })
      }

      return batchDeleteComments({
        ids: options.getSelectedTargets().map((comment) => comment.id),
      })
    },
    onSuccess: async () => {
      toast.success(t('comments.toast.deleted'))
      options.onAfterDeleteSuccess?.()
      await invalidateComments()
    },
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      replyComment(id, text),
    onSuccess: async () => {
      toast.success(t('comments.toast.replied'))
      await invalidateComments()
    },
  })

  return {
    batchDeleteMutation,
    batchStateMutation,
    deleteMutation,
    invalidateComments,
    markReadOnOpenMutation,
    replyMutation,
    stateMutation,
  }
}

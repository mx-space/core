import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deletePost } from '~/api/posts'
import { createTransaction } from '~/data/resource/transaction'
import { posts } from '~/data/resources/post'
import { useI18n } from '~/i18n'

import { postsQueryKey } from '../constants'
import { getErrorMessage } from '../utils/errors'

interface UsePostMutationsOptions {
  onBatchSuccess?: () => void
}

export function usePostMutations(options: UsePostMutationsOptions = {}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidatePosts = async () => {
    await queryClient.invalidateQueries({ queryKey: postsQueryKey })
  }

  const publishMutation = useMutation({
    mutationFn: (payload: { id: string; isPublished: boolean }) =>
      posts.update(payload.id, (draft) => {
        draft.isPublished = payload.isPublished
      }),
    onSuccess: invalidatePosts,
  })

  const categoryMutation = useMutation({
    mutationFn: (payload: { categoryId: string; id: string }) =>
      posts.update(payload.id, (draft) => {
        draft.categoryId = payload.categoryId
      }),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('posts.toast.categoryUpdateFailed')),
      ),
    onSuccess: invalidatePosts,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => posts.delete(id),
    onSuccess: async () => {
      toast.success(t('posts.toast.deleted'))
      await invalidatePosts()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const tx = createTransaction()
      ids.forEach((id) => tx.delete(posts, id))

      return tx.commit(async () => {
        const results = await Promise.allSettled(
          ids.map((id) => deletePost(id)),
        )
        const successfulIds = ids.filter(
          (_, index) => results[index].status === 'fulfilled',
        )

        return {
          failedCount: ids.length - successfulIds.length,
          fulfilledKeys: successfulIds,
          successfulIds,
          successCount: successfulIds.length,
        }
      })
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('posts.toast.batchDeleteFailed'))),
    onSuccess: async ({ failedCount, successCount }) => {
      options.onBatchSuccess?.()
      if (failedCount > 0) {
        toast.warning(
          t('posts.toast.batchDeletePartial', {
            failed: failedCount,
            success: successCount,
          }),
        )
      } else {
        toast.success(
          t('posts.toast.batchDeleteSucceeded', { count: successCount }),
        )
      }
      await invalidatePosts()
    },
  })

  const pinMutation = useMutation({
    mutationFn: (payload: { id: string; isPinned: boolean }) =>
      posts.update(payload.id, (draft) => {
        draft.pinAt = payload.isPinned ? new Date().toISOString() : null
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('posts.toast.pinFailed'))),
    onSuccess: invalidatePosts,
  })

  return {
    batchDeleteMutation,
    categoryMutation,
    deleteMutation,
    invalidatePosts,
    pinMutation,
    publishMutation,
  }
}

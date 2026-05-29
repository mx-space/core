import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deletePost, patchPost } from '~/api/posts'
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
      patchPost(payload.id, { isPublished: payload.isPublished }),
    onSuccess: invalidatePosts,
  })

  const categoryMutation = useMutation({
    mutationFn: (payload: { categoryId: string; id: string }) =>
      patchPost(payload.id, { categoryId: payload.categoryId }),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('posts.toast.categoryUpdateFailed')),
      ),
    onSuccess: invalidatePosts,
  })

  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: async () => {
      toast.success(t('posts.toast.deleted'))
      await invalidatePosts()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deletePost(id)))
      const successfulIds = ids.filter(
        (_, index) => results[index].status === 'fulfilled',
      )

      return {
        failedCount: ids.length - successfulIds.length,
        successfulIds,
        successCount: successfulIds.length,
      }
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
      patchPost(payload.id, {
        pinAt: payload.isPinned ? new Date().toISOString() : null,
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

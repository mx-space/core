import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  movePostCategory,
  pinPost,
  publishPost,
  removePost,
  removePosts,
} from '~/data/resources/post.mutations'
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
      publishPost(payload.id, payload.isPublished),
    onSuccess: invalidatePosts,
  })

  const categoryMutation = useMutation({
    mutationFn: (payload: { categoryId: string; id: string }) =>
      movePostCategory(payload.id, payload.categoryId),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('posts.toast.categoryUpdateFailed')),
      ),
    onSuccess: invalidatePosts,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removePost(id),
    onSuccess: async () => {
      toast.success(t('posts.toast.deleted'))
      await invalidatePosts()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => removePosts(ids),
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
      pinPost(payload.id, payload.isPinned),
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

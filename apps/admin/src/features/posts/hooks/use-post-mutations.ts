import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deletePost, patchPost } from '~/api/posts'
import { PostCategoryResourceTransaction } from '~/data/post-category-resource/transaction'
import { useI18n } from '~/i18n'
import type { PostModel } from '~/models/post'

import { postsQueryKey } from '../constants'
import { getErrorMessage } from '../utils/errors'

interface BatchDeleteResult {
  failedCount: number
  successfulIds: string[]
  successCount: number
}

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
    mutationFn: async (payload: { id: string; isPublished: boolean }) => {
      const tx = new PostCategoryResourceTransaction<PostModel>(
        `publishPost(${payload.id})`,
      ).patchPost(payload.id, {
        isPublished: payload.isPublished,
      })
      tx.request = () =>
        patchPost(payload.id, { isPublished: payload.isPublished })
      tx.onSuccess = async (post: PostModel) => {
        tx.commitPost(post.id, post)
        await invalidatePosts()
      }
      return tx.commit()
    },
  })

  const categoryMutation = useMutation({
    mutationFn: async (payload: { categoryId: string; id: string }) => {
      const tx = new PostCategoryResourceTransaction<PostModel>(
        `updatePostCategory(${payload.id})`,
      ).patchPost(payload.id, {
        categoryId: payload.categoryId,
      })
      tx.request = () =>
        patchPost(payload.id, { categoryId: payload.categoryId })
      tx.onSuccess = async (post: PostModel) => {
        tx.commitPost(post.id, post)
        await invalidatePosts()
      }
      tx.onError = (error) => {
        toast.error(
          getErrorMessage(error, t('posts.toast.categoryUpdateFailed')),
        )
      }
      return tx.commit()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const tx = new PostCategoryResourceTransaction<void>(`deletePost(${id})`)
        .deletePost(id)
      tx.request = () => deletePost(id)
      tx.onSuccess = async () => {
        tx.commitAll()
        toast.success(t('posts.toast.deleted'))
        await invalidatePosts()
      }
      return tx.commit()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const tx = new PostCategoryResourceTransaction<BatchDeleteResult>(
        `batchDeletePosts(${ids.join(',')})`,
      )
      ids.forEach((id) => tx.deletePost(id))
      tx.request = async () => {
        const results = await Promise.allSettled(ids.map((id) => deletePost(id)))
        const successfulIds = ids.filter(
          (_, index) => results[index].status === 'fulfilled',
        )

        return {
          failedCount: ids.length - successfulIds.length,
          successfulIds,
          successCount: successfulIds.length,
        }
      }
      tx.onSuccess = async ({ failedCount, successfulIds, successCount }) => {
        const successfulIdSet = new Set(successfulIds)
        tx.commitPosts(successfulIds)
        tx.rollbackPosts(ids.filter((id) => !successfulIdSet.has(id)))
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
      }
      tx.onError = (error) => {
        toast.error(getErrorMessage(error, t('posts.toast.batchDeleteFailed')))
      }
      return tx.commit()
    },
  })

  const pinMutation = useMutation({
    mutationFn: async (payload: { id: string; isPinned: boolean }) => {
      const pinAt = payload.isPinned ? new Date().toISOString() : null
      const tx = new PostCategoryResourceTransaction<PostModel>(
        `pinPost(${payload.id})`,
      ).patchPost(payload.id, {
        pinAt,
      })
      tx.request = () => patchPost(payload.id, { pinAt })
      tx.onSuccess = async (post: PostModel) => {
        tx.commitPost(post.id, post)
        await invalidatePosts()
      }
      tx.onError = (error) => {
        toast.error(getErrorMessage(error, t('posts.toast.pinFailed')))
      }
      return tx.commit()
    },
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

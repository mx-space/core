import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { deleteTopic } from '~/api/topics'
import { useI18n } from '~/i18n'

import { topicsQueryKey } from '../constants'
import { getErrorMessage } from '../utils/errors'

interface UseTopicMutationsOptions {
  onAfterDeleteSuccess?: () => void
}

export function useTopicMutations(options: UseTopicMutationsOptions = {}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateTopics = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: topicsQueryKey })
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: deleteTopic,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.list.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('topics.list.deleteSuccess'))
      options.onAfterDeleteSuccess?.()
      await invalidateTopics()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteTopic(id)))
      return {
        failedCount: results.filter((r) => r.status === 'rejected').length,
        successCount: results.filter((r) => r.status === 'fulfilled').length,
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.list.deleteFailed'))),
    onSuccess: async ({ failedCount, successCount }) => {
      options.onAfterDeleteSuccess?.()
      if (failedCount > 0) {
        toast.warning(`${successCount}/${successCount + failedCount}`)
      } else {
        toast.success(t('topics.list.deleteSuccess'))
      }
      await invalidateTopics()
    },
  })

  return {
    batchDeleteMutation,
    deleteMutation,
    invalidateTopics,
  }
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { removeTopic, removeTopics } from '~/data/resources/topic.mutations'
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
    mutationFn: removeTopic,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.list.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('topics.list.deleteSuccess'))
      options.onAfterDeleteSuccess?.()
      await invalidateTopics()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => removeTopics(ids),
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

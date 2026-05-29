import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  cancelCronTask,
  CronTaskStatus,
  deleteCronTask,
  deleteCronTasks,
  retryCronTask,
  runCronTask,
} from '~/api/cron-tasks'
import { useI18n } from '~/i18n'

import { definitionQueryKey, taskQueryKey } from '../constants'

export function useCronMutations() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateTasks = () =>
    queryClient.invalidateQueries({ queryKey: taskQueryKey })

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: definitionQueryKey }),
      invalidateTasks(),
    ])
  }

  const run = useMutation({
    mutationFn: runCronTask,
    onError: () => toast.error(t('cron.toast.createFailed')),
    onSuccess: async (result) => {
      if (result.created) toast.success(t('cron.toast.created'))
      else toast.info(t('cron.toast.createDuplicate'))
      await invalidateTasks()
    },
  })

  const cancel = useMutation({
    mutationFn: cancelCronTask,
    onSuccess: async () => {
      toast.success(t('cron.toast.cancelled'))
      await invalidateTasks()
    },
  })

  const retry = useMutation({
    mutationFn: retryCronTask,
    onError: () => toast.error(t('cron.toast.retryFailed')),
    onSuccess: async (result) => {
      if (result.created) toast.success(t('cron.toast.retried'))
      else toast.info(t('cron.toast.retryDuplicate'))
      await invalidateTasks()
    },
  })

  const remove = useMutation({
    mutationFn: deleteCronTask,
    onSuccess: async () => {
      toast.success(t('cron.toast.deleted'))
      await invalidateTasks()
    },
  })

  const clearCompleted = useMutation({
    mutationFn: () =>
      deleteCronTasks({
        before: Date.now(),
        status: CronTaskStatus.Completed,
      }),
    onSuccess: async (result) => {
      toast.success(t('cron.toast.cleared', { count: result.deleted }))
      await invalidateTasks()
    },
  })

  return { cancel, clearCompleted, refreshAll, remove, retry, run }
}

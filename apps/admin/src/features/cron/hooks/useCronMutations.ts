import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { runCronTask } from '~/api/cron-tasks'
import { useI18n } from '~/i18n'

import { definitionQueryKey } from '../constants'

export function useCronMutations() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: definitionQueryKey })
  }

  const run = useMutation({
    mutationFn: runCronTask,
    onError: () => toast.error(t('cron.toast.createFailed')),
    onSuccess: (result) => {
      if (result.created) toast.success(t('cron.toast.created'))
      else toast.info(t('cron.toast.createDuplicate'))
    },
  })

  return { refreshAll, run }
}

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { CreateTaskResponse } from '~/api/tasks'
import { useI18n } from '~/i18n'

import { getErrorMessage } from '../utils/ai'

export function useAiGenerateTask() {
  const { t } = useI18n()

  return useMutation({
    mutationFn: async (fn: () => Promise<CreateTaskResponse>) => fn(),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.taskCreateFailed'))),
    onSuccess: (result) => {
      toast.success(
        result.created ? t('ai.toast.taskCreated') : t('ai.toast.taskExists'),
      )
    },
  })
}

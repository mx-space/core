import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { removeSay } from '~/data/resources/say.mutations'
import { useI18n } from '~/i18n'

import { saysQueryKey } from '../constants'

export function useSayMutations() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateSays = async () => {
    await queryClient.invalidateQueries({ queryKey: saysQueryKey })
  }

  const deleteMutation = useMutation({
    mutationFn: removeSay,
    onSuccess: async () => {
      toast.success(t('says.deleteSuccess'))
      await invalidateSays()
    },
  })

  return {
    deleteMutation,
    invalidateSays,
  }
}

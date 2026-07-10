import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { removeCategory } from '~/data/resources/category.mutations'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

import { categoriesQueryKey } from '../constants'
import { getErrorMessage } from '../utils/errors'

interface UseCategoryMutationsOptions {
  onAfterDeleteSuccess?: () => void
}

export function useCategoryMutations(
  options: UseCategoryMutationsOptions = {},
) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateCategories = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.posts.root })
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeCategory(id),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('categories.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('categories.toast.deleted'))
      options.onAfterDeleteSuccess?.()
      await invalidateCategories()
    },
  })

  return {
    deleteMutation,
    invalidateCategories,
  }
}

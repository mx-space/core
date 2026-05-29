import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { deleteCategory } from '~/api/categories'
import { usePostCategoryResourceStore } from '~/data/post-category-resource/store'
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
    mutationFn: deleteCategory,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('categories.toast.deleteFailed'))),
    onSuccess: async (_, id) => {
      usePostCategoryResourceStore.getState().removeCategory(id)
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

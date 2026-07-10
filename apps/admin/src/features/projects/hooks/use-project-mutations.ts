import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { removeProject } from '~/data/resources/project.mutations'
import { useI18n } from '~/i18n'

import { projectsQueryKey } from '../constants'

interface UseProjectMutationsOptions {
  onDeleted?: () => Promise<void>
}

export function useProjectMutations(options: UseProjectMutationsOptions = {}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey })
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: removeProject,
    onSuccess: async () => {
      toast.success(t('projects.detail.deleteSuccess'))
      await options.onDeleted?.()
      await invalidateProjects()
    },
  })

  return {
    deleteMutation,
    invalidateProjects,
  }
}

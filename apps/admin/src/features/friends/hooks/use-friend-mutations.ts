import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import {
  auditPassLink,
  checkLinksHealth,
  deleteLink,
  migrateLinkAvatars,
} from '~/api/links'
import { useI18n } from '~/i18n'

import { friendsQueryKey } from '../constants'

interface UseFriendMutationsOptions {
  onHealthResult?: (
    result: Awaited<ReturnType<typeof checkLinksHealth>>,
  ) => void
}

export function useFriendMutations(options: UseFriendMutationsOptions = {}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateFriends = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: friendsQueryKey })
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: deleteLink,
    onSuccess: async () => {
      toast.success(t('friends.toast.deleted'))
      await invalidateFriends()
    },
  })

  const auditPassMutation = useMutation({
    mutationFn: auditPassLink,
    onSuccess: async () => {
      toast.success(t('friends.toast.auditPass'))
      await invalidateFriends()
    },
  })

  const healthMutation = useMutation({
    mutationFn: checkLinksHealth,
    onSuccess: (result) => {
      options.onHealthResult?.(result)
      toast.success(t('friends.toast.healthDone'))
    },
  })

  const migrateMutation = useMutation({
    mutationFn: migrateLinkAvatars,
    onSuccess: async () => {
      toast.success(t('friends.toast.migrated'))
      await invalidateFriends()
    },
  })

  return {
    auditPassMutation,
    deleteMutation,
    healthMutation,
    invalidateFriends,
    migrateMutation,
  }
}

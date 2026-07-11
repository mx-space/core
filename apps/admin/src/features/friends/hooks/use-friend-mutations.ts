import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { checkLinksHealth, migrateLinkAvatars } from '~/api/links'
import { auditPass, removeLink } from '~/data/resources/link.mutations'
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
    mutationFn: removeLink,
    onSuccess: async () => {
      toast.success(t('friends.toast.deleted'))
      await invalidateFriends()
    },
  })

  const auditPassMutation = useMutation({
    mutationFn: auditPass,
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

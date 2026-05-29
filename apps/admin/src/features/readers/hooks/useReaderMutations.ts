import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ReaderModel } from '~/api/readers'
import type { TranslationKey } from '~/i18n/types'

import {
  banReader,
  revokeOwner,
  transferOwner,
  unbanReader,
} from '~/api/readers'
import { useI18n } from '~/i18n'

import { readersQueryKey } from '../constants'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

interface BanVariables {
  id: string
  reason?: string
}

interface DetailMutationContext {
  previous?: ReaderModel
}

export function useReaderMutations() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: readersQueryKey })

  const successToast = (key: TranslationKey) => toast.success(t(key))
  const failureToast = (error: unknown, key: TranslationKey) =>
    toast.error(getErrorMessage(error, t(key)))

  const detailKey = (id: string) => [...readersQueryKey, 'detail', id]

  const transferOwnerMutation = useMutation({
    mutationFn: (id: string) => transferOwner(id),
    onError: (error) => failureToast(error, 'readers.toast.transferFailed'),
    onSuccess: async () => {
      successToast('readers.toast.transferred')
      await invalidate()
    },
  })

  const revokeOwnerMutation = useMutation({
    mutationFn: (id: string) => revokeOwner(id),
    onError: (error) => failureToast(error, 'readers.toast.revokeFailed'),
    onSuccess: async () => {
      successToast('readers.toast.revoked')
      await invalidate()
    },
  })

  const banMutation = useMutation<
    ReaderModel,
    unknown,
    BanVariables,
    DetailMutationContext
  >({
    mutationFn: ({ id, reason }) => banReader(id, reason),
    onError: (error, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey(id), context.previous)
      }
      failureToast(error, 'readers.toast.banFailed')
    },
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: detailKey(id) })
      const previous = queryClient.getQueryData<ReaderModel>(detailKey(id))
      if (previous) {
        queryClient.setQueryData<ReaderModel>(detailKey(id), {
          ...previous,
          banReason: reason ?? null,
          bannedAt: new Date().toISOString(),
        })
      }
      return { previous }
    },
    onSuccess: async (_data, { id }) => {
      successToast('readers.toast.banned')
      await queryClient.invalidateQueries({ queryKey: detailKey(id) })
      await invalidate()
    },
  })

  const unbanMutation = useMutation<
    ReaderModel,
    unknown,
    string,
    DetailMutationContext
  >({
    mutationFn: (id: string) => unbanReader(id),
    onError: (error, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey(id), context.previous)
      }
      failureToast(error, 'readers.toast.unbanFailed')
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: detailKey(id) })
      const previous = queryClient.getQueryData<ReaderModel>(detailKey(id))
      if (previous) {
        queryClient.setQueryData<ReaderModel>(detailKey(id), {
          ...previous,
          banReason: null,
          bannedAt: null,
        })
      }
      return { previous }
    },
    onSuccess: async (_data, id) => {
      successToast('readers.toast.unbanned')
      await queryClient.invalidateQueries({ queryKey: detailKey(id) })
      await invalidate()
    },
  })

  return {
    banReader: banMutation,
    revokeOwner: revokeOwnerMutation,
    transferOwner: transferOwnerMutation,
    unbanReader: unbanMutation,
  }
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { deleteNote, patchNote, patchNotePublish } from '~/api/notes'
import { useI18n } from '~/i18n'

import { notesQueryKey } from '../constants'
import type { NoteMetadataUpdate } from '../types/notes'
import { getErrorMessage } from '../utils/errors'

interface UseNoteMutationsOptions {
  onBatchSuccess?: () => void
}

export function useNoteMutations(options: UseNoteMutationsOptions = {}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()

  const invalidateNotes = async () => {
    await queryClient.invalidateQueries({ queryKey: notesQueryKey })
  }

  const publishMutation = useMutation({
    mutationFn: (payload: { id: string; isPublished: boolean }) =>
      patchNotePublish(payload.id, payload.isPublished),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.updateFailed'))),
    onSuccess: invalidateNotes,
  })

  const patchMutation = useMutation({
    mutationFn: (payload: { data: NoteMetadataUpdate; id: string }) =>
      patchNote(payload.id, payload.data),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.updateFailed'))),
    onSuccess: invalidateNotes,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('notes.toast.deleted'))
      await invalidateNotes()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteNote(id)))
      const successfulIds = ids.filter(
        (_, index) => results[index].status === 'fulfilled',
      )

      return {
        failedCount: ids.length - successfulIds.length,
        successfulIds,
        successCount: successfulIds.length,
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.batchDeleteFailed'))),
    onSuccess: async ({ failedCount, successCount }) => {
      options.onBatchSuccess?.()
      if (failedCount > 0) {
        toast.warning(
          t('notes.toast.batchDeletePartial', {
            failed: failedCount,
            success: successCount,
          }),
        )
      } else {
        toast.success(
          t('notes.toast.batchDeleteSucceeded', { count: successCount }),
        )
      }
      await invalidateNotes()
    },
  })

  return {
    batchDeleteMutation,
    deleteMutation,
    invalidateNotes,
    patchMutation,
    publishMutation,
  }
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { batchDeleteDrafts, compactDraft } from '~/api/drafts'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { DraftCard } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'

import { confirmDeleteDrafts } from '../components/DeleteDraftDialog'
import { getErrorMessage } from '../utils/errors'

export function useDraftMutations(options: { onDeleted: () => void }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const refresh = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.drafts.root }),
    [queryClient],
  )

  const remove = useMutation({
    mutationFn: (ids: string[]) => batchDeleteDrafts(ids),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.toast.deleteFailed'))),
    onSuccess: async (result) => {
      options.onDeleted()
      if (result.skipped.length) {
        toast.warning(
          t('drafts.toast.deletePartial', { count: result.skipped.length }),
        )
      } else {
        toast.success(
          t('drafts.toast.deletedFreed', {
            size: formatBytes(result.freed.bytes),
          }),
        )
      }
      await refresh()
    },
  })

  const compact = useMutation({
    mutationFn: async (ids: string[]) => {
      let bytes = 0
      for (const id of ids) bytes += (await compactDraft(id)).bytes
      return bytes
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.compact.failed'))),
    onSuccess: async (bytes) => {
      toast.success(t('drafts.compact.done', { size: formatBytes(bytes) }))
      await refresh()
    },
  })

  const confirmDelete = useCallback(
    async (targets: DraftCard[]) => {
      if (!targets.length || !(await confirmDeleteDrafts(targets))) return
      remove.mutate(targets.map((target) => target.id))
    },
    [remove],
  )

  const confirmCompact = useCallback(
    async (targets: DraftCard[]) => {
      if (!targets.length) return
      const confirmed = await confirmDialog({
        confirmText: t('drafts.compact.confirm'),
        description: t('drafts.compact.description'),
        destructive: true,
        title: t('drafts.compact.title', { count: targets.length }),
      })
      if (confirmed) compact.mutate(targets.map((target) => target.id))
    },
    [compact, t],
  )

  return {
    compacting: compact.isPending,
    confirmCompact,
    confirmDelete,
    deleting: remove.isPending,
  }
}

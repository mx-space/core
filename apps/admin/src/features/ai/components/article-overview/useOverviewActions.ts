import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  deleteInsights,
  deleteSummary,
  deleteTranslation,
  deleteTts,
} from '~/api/ai'
import type { AiOverviewCapability, AiOverviewDetail } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

import { useAiGenerateTask } from '../../hooks/use-ai-generate-task'
import { getErrorMessage } from '../../utils/ai'
import { buildGenerateTask } from './overview-generate-task'

const deleteByCapability: Record<
  AiOverviewCapability,
  (id: string) => Promise<unknown>
> = {
  summary: deleteSummary,
  insights: deleteInsights,
  translation: deleteTranslation,
  tts: deleteTts,
}

export function useOverviewActions(refId: string) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const generateMutation = useAiGenerateTask()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.ai.overviewArticle(refId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.ai.overviewListRoot,
      }),
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.tasks.tasksRoot,
      }),
    ])
  }

  const deleteMutation = useMutation({
    mutationFn: (input: { capability: AiOverviewCapability; id: string }) =>
      deleteByCapability[input.capability](input.id),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.deleted'))
      await invalidate()
    },
  })

  // Regenerating an asset that already exists has to force: without it the
  // task dedupes against the stored hash and returns the very row being
  // replaced.
  //
  // `langs` undefined means "whatever the server has configured" — a retry of a
  // task whose payload carried no languages must stay that way instead of
  // collapsing to one guessed language.
  const generate = (
    capability: AiOverviewCapability,
    langs: string[] | undefined,
    detail: AiOverviewDetail,
    force = false,
  ) => {
    generateMutation.mutate(
      () => buildGenerateTask(capability, langs, refId, detail, force),
      { onSuccess: () => void invalidate() },
    )
  }

  return {
    generate,
    remove: (capability: AiOverviewCapability, id: string) =>
      deleteMutation.mutate({ capability, id }),
    isMutating: generateMutation.isPending || deleteMutation.isPending,
  }
}

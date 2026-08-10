import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createInsightsTask,
  createInsightsTranslationTask,
  createSummaryTask,
  createTranslationTask,
  createTtsTask,
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
  const generate = (
    capability: AiOverviewCapability,
    lang: string,
    detail: AiOverviewDetail,
    force = false,
  ) => {
    generateMutation.mutate(
      () => buildTask(capability, lang, refId, detail, force),
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

/**
 * Insights translations are a separate endpoint that reads an existing
 * source-language row, so a target language can only be dispatched once a
 * non-translation row exists — otherwise the base task has to run first.
 */
function buildTask(
  capability: AiOverviewCapability,
  lang: string,
  refId: string,
  detail: AiOverviewDetail,
  force: boolean,
) {
  switch (capability) {
    case 'summary': {
      return createSummaryTask({ force, refId, targetLanguages: [lang] })
    }
    case 'insights': {
      const base = detail.assets.insights.find((row) => !row.isTranslation)
      if (!base || base.lang === lang)
        return createInsightsTask({ force, refId })
      return createInsightsTranslationTask({ refId, targetLang: lang })
    }
    case 'translation': {
      return createTranslationTask({ force, refId, targetLanguages: [lang] })
    }
    case 'tts': {
      return createTtsTask({ force, langs: [lang], refId })
    }
  }
}

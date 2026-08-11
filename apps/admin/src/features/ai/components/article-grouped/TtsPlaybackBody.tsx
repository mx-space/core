import { useMutation } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { toast } from 'sonner'

import type { AITtsRow } from '~/api/ai'
import { TtsSegmentPlayer } from '~/features/_shared/components/tts/TtsSegmentPlayer'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { getErrorMessage } from '../../utils/ai'
import { useArticleGroupedRouteContext } from './article-grouped-route-context'
import { GenerationMetricsMeta } from './GenerationMetricsMeta'
import type { EditDrawerBodyProps, ItemAction } from './types'

export function TtsPlaybackBody(props: EditDrawerBodyProps<AITtsRow>) {
  const { t } = useI18n()
  const { item } = props
  const ctx = useArticleGroupedRouteContext<AITtsRow>()

  const itemActions = ctx.config.extraItemActions?.(item) ?? []
  const regenerateAction = itemActions.find((a) => a.id === 'regenerate')
  const resumeAction = itemActions.find((a) => a.id === 'resume')

  const actionMutation = useMutation({
    mutationFn: async (action: ItemAction<AITtsRow>) => action.run(item),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.taskCreateFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.taskCreated'))
      await ctx.invalidate()
    },
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            {item.lang.toUpperCase()}
          </span>
          <span className="text-fg-muted">
            {item.segments.length} {t('ttsPlayer.segmentsTitle')} ·{' '}
            {item.charCount} {t('ai.tts.charCountLabel')}
          </span>
        </div>
        <p className="-mt-3 text-xs text-fg-subtle">
          {item.model} · {item.voice} · {item.speed}x
        </p>

        {resumeAction ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-950 dark:bg-amber-950/30">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('ai.tts.incompleteNotice')}
            </p>
            <Button
              className="shrink-0"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate(resumeAction)}
              type="button"
              variant="secondary"
            >
              <Play aria-hidden="true" className="size-3.5" />
              {t('ai.action.resumeTts')}
            </Button>
          </div>
        ) : null}

        <GenerationMetricsMeta metrics={item.generationMetrics} />

        <TtsSegmentPlayer
          onRegenerate={
            regenerateAction
              ? () => actionMutation.mutate(regenerateAction)
              : undefined
          }
          regenerateSubmitting={actionMutation.isPending}
          segments={item.segments}
        />
      </div>
    </div>
  )
}

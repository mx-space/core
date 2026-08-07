import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { AITtsRow } from '~/api/ai'
import { TtsSegmentPlayer } from '~/features/_shared/components/tts/TtsSegmentPlayer'
import { useI18n } from '~/i18n'

import { getErrorMessage } from '../../utils/ai'
import { useArticleGroupedRouteContext } from './article-grouped-route-context'
import type { EditDrawerBodyProps } from './types'

export function TtsPlaybackBody(props: EditDrawerBodyProps<AITtsRow>) {
  const { t } = useI18n()
  const { item } = props
  const ctx = useArticleGroupedRouteContext<AITtsRow>()

  const regenerateAction = ctx.config
    .extraItemActions?.(item)
    .find((a) => a.id === 'regenerate')

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!regenerateAction) return
      await regenerateAction.run(item)
    },
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

        <TtsSegmentPlayer
          onRegenerate={
            regenerateAction ? () => regenerateMutation.mutate() : undefined
          }
          regenerateSubmitting={regenerateMutation.isPending}
          segments={item.segments}
        />
      </div>
    </div>
  )
}

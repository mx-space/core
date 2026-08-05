import type { AITtsSegment } from '~/api/ai'
import { useI18n } from '~/i18n'

export function TtsSegmentList(props: { segments: AITtsSegment[] }) {
  const { t } = useI18n()

  if (props.segments.length === 0) {
    return (
      <p className="text-xs leading-5 text-fg-subtle">
        {t('write.ttsGeneration.segments.empty')}
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-fg-muted">
        {t('write.ttsGeneration.segmentsTitle')}
      </span>
      <div className="space-y-2">
        {props.segments.map((segment, index) => (
          <div
            className="space-y-2 rounded-md border border-border bg-surface-card p-2.5"
            key={`${segment.blockId}-${segment.chunkIndex}`}
          >
            <p className="text-xs leading-5 text-fg">
              <span className="mr-1.5 tabular-nums text-fg-subtle">
                {index + 1}.
              </span>
              {segment.text}
            </p>
            <audio className="h-8 w-full" controls src={segment.url} />
          </div>
        ))}
      </div>
    </div>
  )
}

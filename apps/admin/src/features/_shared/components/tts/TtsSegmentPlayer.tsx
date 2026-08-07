import { Pause, Play, RefreshCw, Square } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import type { AITtsSegment } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { useTtsPlayback } from './use-tts-playback'

export function TtsSegmentPlayer(props: {
  segments: AITtsSegment[]
  onRegenerate?: () => void
  regenerateSubmitting?: boolean
}) {
  const { t } = useI18n()
  const urls = useMemo(
    () => props.segments.map((segment) => segment.url),
    [props.segments],
  )
  const playback = useTtsPlayback(urls)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (playback.playingIndex === null) return
    itemRefs.current[playback.playingIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [playback.playingIndex])

  if (props.segments.length === 0) {
    return (
      <p className="text-xs leading-5 text-fg-subtle">{t('ttsPlayer.empty')}</p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1.5">
        {playback.playingIndex !== null ? (
          <span className="text-xs tabular-nums text-fg-muted">
            {t('ttsPlayer.progress', {
              current: playback.playingIndex + 1,
              total: props.segments.length,
            })}
          </span>
        ) : null}
        {props.onRegenerate ? (
          <Button
            className="h-7 px-2 text-xs"
            disabled={props.regenerateSubmitting}
            onClick={props.onRegenerate}
            type="button"
            variant="ghost"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-3.5',
                props.regenerateSubmitting && 'animate-spin',
              )}
            />
            {t('ai.action.regenerate')}
          </Button>
        ) : null}
        <Button
          className="h-7 px-2 text-xs"
          onClick={playback.playAll}
          type="button"
          variant="ghost"
        >
          <Play aria-hidden="true" className="size-3.5" />
          {t('ttsPlayer.playAll')}
        </Button>
        {playback.playingIndex !== null ? (
          <Button
            className="h-7 px-2 text-xs"
            onClick={playback.stop}
            type="button"
            variant="ghost"
          >
            <Square aria-hidden="true" className="size-3.5" />
            {t('ttsPlayer.stop')}
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute bottom-4 left-4 top-4 w-px bg-border"
        />
        <div className="space-y-2">
          {props.segments.map((segment, index) => {
            const active = playback.playingIndex === index
            const segmentPlaying = active && playback.isPlaying
            return (
              <div
                className="relative flex items-start gap-3"
                key={`${segment.blockId}-${segment.chunkIndex}`}
                ref={(element) => {
                  itemRefs.current[index] = element
                }}
              >
                <button
                  aria-label={
                    segmentPlaying
                      ? t('ttsPlayer.pauseSegment')
                      : t('ttsPlayer.playSegment')
                  }
                  className={cn(
                    'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-all',
                    'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                    active
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-card text-fg-muted ring-1 ring-inset ring-border hover:text-fg hover:ring-border-strong',
                  )}
                  onClick={() => playback.toggleSegment(index)}
                  type="button"
                >
                  {segmentPlaying ? (
                    <Pause aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Play aria-hidden="true" className="size-3.5" />
                  )}
                </button>
                <div
                  className={cn(
                    'min-w-0 flex-1 rounded-lg px-3 py-2 transition-colors',
                    active ? 'bg-accent-soft' : 'hover:bg-surface-inset/50',
                  )}
                >
                  <p className="text-xs leading-5 text-fg">{segment.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

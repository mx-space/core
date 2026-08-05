import { AudioLines, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react'

import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { Drawer } from '~/ui/feedback/drawer'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { TtsSegmentList } from './TtsSegmentList'
import type { useTtsGeneration } from './use-tts-generation'

type TtsGenerationDrawerProps = ReturnType<typeof useTtsGeneration>

export function TtsGenerationDrawer(props: TtsGenerationDrawerProps) {
  const { t } = useI18n()

  const handleDelete = async () => {
    const row = props.activeRow
    if (!row) return
    const confirmed = await confirmDialog({
      destructive: true,
      title: t('write.ttsGeneration.deleteConfirm.title', { lang: row.lang }),
    })
    if (!confirmed) return
    props.deleteRow(row.id)
  }

  return (
    <Drawer
      icon={AudioLines}
      onClose={props.closeDrawer}
      open={props.open}
      title={t('write.ttsGeneration.title')}
      widthClassName="w-[min(90vw,32rem)]"
    >
      <Scroll className="min-h-0 flex-1" innerClassName="space-y-4 p-4">
        {props.rows.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {props.rows.map((row) => {
              const active = row.lang === props.activeLang
              return (
                <button
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                    active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface-card text-fg-muted hover:text-fg',
                  )}
                  key={row.lang}
                  onClick={() => props.setActiveLang(row.lang)}
                  type="button"
                >
                  {row.lang}
                </button>
              )
            })}
          </div>
        ) : null}

        {props.isLoading ? (
          <p className="text-xs text-fg-subtle">
            {t('write.ttsGeneration.status.loading')}
          </p>
        ) : props.activeRow ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-border bg-surface-inset p-3 text-xs">
                <ConfigItem
                  label={t('write.ttsGeneration.modelLabel')}
                  value={props.activeRow.model}
                />
                <ConfigItem
                  label={t('write.ttsGeneration.voiceLabel')}
                  value={props.activeRow.voice}
                />
                <ConfigItem
                  label={t('write.ttsGeneration.speedLabel')}
                  value={String(props.activeRow.speed)}
                />
                <ConfigItem
                  label={t('write.ttsGeneration.blockCountLabel')}
                  value={t('write.ttsGeneration.blockCount', {
                    count: props.activeRow.blockOrder.length,
                  })}
                />
              </div>
              <Button
                aria-label={t('write.ttsGeneration.deleteAria')}
                disabled={props.isDeleting || props.isRunning}
                iconOnly
                onClick={() => void handleDelete()}
                type="button"
                variant="ghost"
              >
                {props.isDeleting ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-fg-subtle">
              {t('write.ttsGeneration.charCount', {
                count: props.activeRow.charCount,
              })}
            </p>
            <TtsSegmentList segments={props.activeRow.segments} />
          </div>
        ) : (
          <EmptyState
            description={t('write.ttsGeneration.empty.description')}
            icon={AudioLines}
            title={t('write.ttsGeneration.empty.title')}
          />
        )}

        {props.runStatus !== 'idle' ? (
          <RunStatusPanel
            progress={props.progress}
            progressMessage={props.progressMessage}
            runError={props.runError}
            runStatus={props.runStatus}
          />
        ) : null}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={props.isRunning}
            onClick={props.generate}
            type="button"
          >
            {props.isRunning ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {t('write.ttsGeneration.generate')}
          </Button>
          <Button
            className="flex-1"
            disabled={props.isRunning}
            onClick={props.regenerate}
            type="button"
            variant="secondary"
          >
            {props.isRunning ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="size-4" />
            )}
            {t('write.ttsGeneration.regenerate')}
          </Button>
        </div>
        <p className="text-xs text-fg-subtle">
          {t('write.ttsGeneration.regenerateHint')}
        </p>
      </Scroll>
    </Drawer>
  )
}

function ConfigItem(props: { label: string; value: string }) {
  return (
    <div>
      <div className="text-fg-subtle">{props.label}</div>
      <div className="font-medium text-fg">{props.value}</div>
    </div>
  )
}

function RunStatusPanel(props: {
  progress: null | number
  progressMessage?: string
  runError?: string
  runStatus: 'failed' | 'running' | 'succeeded'
}) {
  const { t } = useI18n()
  const percent = Math.max(0, Math.min(100, props.progress ?? 0))

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border p-3 text-xs',
        props.runStatus === 'failed'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300'
          : 'border-border bg-surface-inset text-fg-muted',
      )}
    >
      <div className="flex items-center justify-between">
        <span>
          {props.runStatus === 'running'
            ? t('write.ttsGeneration.status.generating')
            : props.runStatus === 'succeeded'
              ? t('write.ttsGeneration.status.upToDate')
              : t('write.ttsGeneration.status.failed')}
        </span>
        {props.runStatus === 'running' && props.progress !== null ? (
          <span className="tabular-nums">{Math.round(percent)}%</span>
        ) : null}
      </div>
      {props.runStatus === 'running' ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-card">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {props.runStatus === 'running' && props.progressMessage ? (
        <p>{props.progressMessage}</p>
      ) : null}
      {props.runStatus === 'failed' && props.runError ? (
        <p>{props.runError}</p>
      ) : null}
    </div>
  )
}

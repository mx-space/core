import { useAtom, useAtomValue } from 'jotai'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  X,
  XCircle,
} from 'lucide-react'
import { Link, useBeforeUnload } from 'react-router'

import { AITaskStatus } from '~/api/tasks'
import { CAPABILITY_META } from '~/features/ai/components/article-overview/capability-meta'
import { statusIcon, taskStatusLabelKeys } from '~/features/tasks/constants'
import {
  getProgress,
  getTaskProgressLabel,
  statusIconClassName,
} from '~/features/tasks/utils/tasks'
import {
  dismissPublishProcess,
  isPublishProcessActive,
  type PublishProcess,
  publishProcessDockOpenAtom,
  publishProcessesAtom,
  type PublishProcessPhase,
  type PublishProcessResource,
} from '~/features/write/utils/publish-process-state'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { confirmDialog } from '~/ui/feedback/confirm'
import { Popover } from '~/ui/overlay/popover'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

const phaseLabelKeys: Record<PublishProcessPhase, TranslationKey> = {
  cancelled: 'write.publishProcess.cancelled',
  cancelling: 'write.publishProcess.cancelling',
  completed: 'write.publishProcess.completed',
  failed: 'write.publishProcess.failed',
  preparing: 'write.publishProcess.preparing',
  publishing: 'write.publishProcess.publishing',
}

export function PublishProcessDock() {
  const { t } = useI18n()
  const processes = useAtomValue(publishProcessesAtom)
  const [open, setOpen] = useAtom(publishProcessDockOpenAtom)
  const hasActiveProcess = processes.some((process) =>
    isPublishProcessActive(process.phase),
  )

  useBeforeUnload(
    (event) => {
      if (hasActiveProcess) event.preventDefault()
    },
    { capture: true },
  )

  if (processes.length === 0) return null

  const current = getCurrentProcess(processes)
  const progress = getProcessProgress(current)
  const failed = current.phase === 'failed'
  const CurrentIcon = getPhaseIcon(current.phase)

  return (
    <div className="fixed right-4 bottom-4 z-[1090] max-sm:left-4">
      <Popover onOpenChange={setOpen} open={open}>
        <Popover.Trigger
          aria-label={t('write.publishProcess.open')}
          className={cn(
            'flex h-10 max-w-[min(24rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-border bg-surface-overlay px-3 text-sm shadow-lg transition-colors hover:bg-surface-card focus-visible:ring-[3px] focus-visible:ring-accent/20',
            failed && 'border-red-500/40',
          )}
        >
          <CurrentIcon
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0',
              current.phase === 'preparing' || current.phase === 'cancelling'
                ? 'animate-spin text-blue-500'
                : current.phase === 'publishing'
                  ? 'animate-spin text-accent'
                  : current.phase === 'completed'
                    ? 'text-emerald-500'
                    : current.phase === 'failed'
                      ? 'text-red-500'
                      : 'text-fg-subtle',
            )}
          />
          <span aria-live="polite" className="min-w-0 truncate">
            {t(phaseLabelKeys[current.phase])}
          </span>
          {isPublishProcessActive(current.phase) ? (
            <span className="shrink-0 text-xs text-fg-muted tabular-nums">
              {progress}%
            </span>
          ) : null}
          {processes.length > 1 ? (
            <span className="shrink-0 rounded-full bg-surface-inset px-1.5 text-xs text-fg-muted tabular-nums">
              {processes.length}
            </span>
          ) : null}
        </Popover.Trigger>
        <Popover.Content
          align="end"
          className="max-h-[min(72vh,38rem)] overflow-hidden"
          side="top"
          sideOffset={8}
          width="lg"
        >
          <Popover.Header>{t('write.publishProcess.title')}</Popover.Header>
          <Popover.Body className="max-h-[min(64vh,34rem)] overflow-y-auto p-0">
            {processes.map((process) => (
              <ProcessDetail key={process.id} process={process} />
            ))}
          </Popover.Body>
        </Popover.Content>
      </Popover>
    </div>
  )
}

function ProcessDetail({ process }: { process: PublishProcess }) {
  const { t } = useI18n()
  const progress = getProcessProgress(process)
  const terminal = !isPublishProcessActive(process.phase)
  const editPath = `/${process.kind === 'post' ? 'posts' : 'notes'}/edit?id=${encodeURIComponent(process.refId)}`

  const terminate = async () => {
    const confirmed = await confirmDialog({
      confirmText: t('write.publishProcess.terminate'),
      description: t('write.publishProcess.terminateDescription'),
      destructive: true,
      title: t('write.publishProcess.terminateTitle'),
    })
    if (confirmed) {
      const { cancelPublishProcess } = await import(
        '~/features/write/utils/prepare-post-publish'
      )
      await cancelPublishProcess(process.id)
    }
  }

  return (
    <section className="border-b border-border p-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            className="block truncate font-medium hover:text-accent hover:underline"
            to={editPath}
          >
            {process.title || t(`write.kind.${process.kind}`)}
          </Link>
          <p className="mt-0.5 text-xs text-fg-muted">
            {t(phaseLabelKeys[process.phase])}
          </p>
        </div>
        {process.phase === 'preparing' ? (
          <Button
            className="h-10 shrink-0 text-xs"
            onClick={() => void terminate()}
            variant="secondary"
          >
            {t('write.publishProcess.terminate')}
          </Button>
        ) : terminal ? (
          <Button
            aria-label={t('common.close')}
            className="size-10 shrink-0"
            iconOnly
            onClick={() => dismissPublishProcess(process.id)}
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              'h-full transition-[width] duration-300',
              process.phase === 'failed' ? 'bg-red-500' : 'bg-accent',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-9 text-right text-xs text-fg-muted tabular-nums">
          {progress}%
        </span>
      </div>

      <ul className="mt-2 divide-y divide-border/70">
        {process.resources.map((resource) => (
          <ResourceProgress key={resource.resource} resource={resource} />
        ))}
      </ul>

      {process.error ? (
        <p className="mt-2 text-xs break-words text-red-600 dark:text-red-400">
          {process.error}
        </p>
      ) : null}
    </section>
  )
}

function ResourceProgress({ resource }: { resource: PublishProcessResource }) {
  const { t } = useI18n()
  const meta = CAPABILITY_META[resource.resource]
  const CapabilityIcon = meta.icon
  const StatusIcon =
    resource.status === 'queued' ? Clock : statusIcon[resource.status]
  const progress = getResourceProgress(resource)
  const progressLabel = resource.task
    ? getTaskProgressLabel(resource.task)
    : null

  return (
    <li className="flex min-h-10 items-center gap-2 py-1.5 text-xs">
      <CapabilityIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-fg-muted"
      />
      <span className="min-w-0 flex-1 truncate">{t(meta.labelKey)}</span>
      <span className="shrink-0 text-fg-muted tabular-nums">
        {progressLabel ?? `${progress}%`}
      </span>
      {resource.taskId ? (
        <Link
          aria-label={t('write.publishProcess.viewTask')}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
          to={`/tasks/${encodeURIComponent(resource.taskId)}`}
        >
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
      <span className="inline-flex min-w-20 items-center justify-end gap-1.5 text-fg-muted">
        <StatusIcon
          aria-hidden="true"
          className={cn(
            'size-3.5',
            resource.status === 'queued'
              ? 'text-fg-subtle'
              : statusIconClassName(resource.status),
            resource.status === AITaskStatus.Running && 'animate-spin',
          )}
        />
        {resource.status === 'queued'
          ? t('write.publishProcess.queued')
          : t(taskStatusLabelKeys[resource.status])}
      </span>
    </li>
  )
}

function getResourceProgress(resource: PublishProcessResource) {
  if (resource.status === AITaskStatus.Completed) return 100
  const progress = resource.task ? getProgress(resource.task) : 0
  return Math.round(Math.min(100, Math.max(0, progress ?? 0)))
}

function getProcessProgress(process: PublishProcess) {
  if (process.phase === 'completed' || process.phase === 'publishing')
    return 100
  const total = process.resources.reduce(
    (sum, resource) => sum + getResourceProgress(resource),
    0,
  )
  return Math.round(total / process.resources.length)
}

function getPhaseIcon(phase: PublishProcessPhase) {
  if (phase === 'completed') return CheckCircle2
  if (phase === 'failed') return AlertCircle
  if (phase === 'cancelled') return XCircle
  return Loader2
}

function getCurrentProcess(processes: PublishProcess[]) {
  for (let index = processes.length - 1; index >= 0; index -= 1) {
    const process = processes[index]
    if (isPublishProcessActive(process.phase)) return process
  }
  return processes.at(-1)!
}

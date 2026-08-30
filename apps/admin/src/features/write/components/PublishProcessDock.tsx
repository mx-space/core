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
            'flex h-10 max-w-[min(24rem,calc(100vw-2rem))] items-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 text-sm shadow-lg transition-[transform,background-color,border-color] duration-200 hover:bg-surface-card focus-visible:ring-[3px] focus-visible:ring-accent/20 motion-reduce:transition-none',
            open && 'scale-[0.97]',
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
      const { cancelPublishProcess } =
        await import('~/features/write/utils/prepare-post-publish')
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
            className="h-7 shrink-0 px-2 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
            onClick={() => void terminate()}
            variant="ghost"
          >
            {t('write.publishProcess.terminate')}
          </Button>
        ) : terminal ? (
          <Button
            aria-label={t('common.close')}
            className="size-7 shrink-0"
            iconOnly
            onClick={() => dismissPublishProcess(process.id)}
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              process.phase === 'failed' ? 'bg-red-500' : 'bg-accent',
              progress === 0 &&
                !terminal &&
                'w-full! animate-[dock-sweep_1.5s_linear_infinite] bg-[linear-gradient(100deg,transparent_0%,var(--color-accent)_45%,transparent_90%)] bg-[length:220%_100%] opacity-60 motion-reduce:animate-none',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-9 text-right text-xs text-fg-muted tabular-nums">
          {progress}%
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-px">
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
  const progress = getResourceProgress(resource)
  const progressLabel = resource.task
    ? getTaskProgressLabel(resource.task)
    : null
  const failed =
    resource.status === AITaskStatus.Failed ||
    resource.status === AITaskStatus.PartialFailed
  const completed = resource.status === AITaskStatus.Completed
  const StatusIcon =
    resource.status === 'queued' ? Clock : statusIcon[resource.status]
  const showLabel = resource.status !== AITaskStatus.Running && !completed

  return (
    <li
      className={cn(
        'group relative flex h-8 items-center gap-2 rounded-sm pr-2 pl-2.5 text-xs transition-colors hover:bg-surface-inset',
        failed &&
          'before:absolute before:inset-y-1.5 before:left-0.5 before:w-0.5 before:rounded-full before:bg-red-500 motion-safe:before:animate-[dock-mark_.28s_cubic-bezier(.34,1.56,.64,1)]',
      )}
    >
      <CapabilityIcon
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0',
          failed
            ? 'text-red-500'
            : completed
              ? 'text-emerald-500'
              : 'text-fg-subtle',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{t(meta.labelKey)}</span>
      {resource.taskId ? (
        <Link
          aria-label={t('write.publishProcess.viewTask')}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-subtle opacity-0 transition-[opacity,color] hover:text-fg focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15 group-hover:opacity-100"
          to={`/tasks/${encodeURIComponent(resource.taskId)}`}
        >
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-end gap-1.5 tabular-nums',
          failed
            ? 'text-red-600 dark:text-red-400'
            : completed
              ? 'text-emerald-500'
              : 'text-fg-muted',
        )}
      >
        {showLabel ? (
          <>
            <StatusIcon
              aria-hidden="true"
              className={cn(
                'size-3.5',
                resource.status === 'queued'
                  ? 'text-fg-subtle'
                  : statusIconClassName(resource.status),
              )}
            />
            {resource.status === 'queued'
              ? t('write.publishProcess.queued')
              : t(taskStatusLabelKeys[resource.status])}
          </>
        ) : completed ? (
          <>
            <CheckCircle2
              aria-hidden="true"
              className="size-3.5 motion-safe:animate-[dock-mark_.34s_cubic-bezier(.34,1.56,.64,1)]"
            />
            <span className="sr-only">
              {t(taskStatusLabelKeys[resource.status])}
            </span>
          </>
        ) : (
          (progressLabel ?? `${progress}%`)
        )}
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

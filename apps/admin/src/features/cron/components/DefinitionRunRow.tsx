import { ChevronRight, RotateCcw, Trash2, XCircle } from 'lucide-react'

import type { CronTask } from '~/api/cron-tasks'
import { CronTaskStatus } from '~/api/cron-tasks'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { taskStatusIconClassNames, taskStatusIcons } from '../constants'
import { formatRelativeDate } from '../utils/cron'

export function DefinitionRunRow(props: {
  busy: boolean
  onCancel: () => void
  onDelete: () => void
  onOpen: () => void
  onRetry: () => void
  task: CronTask
}) {
  const { t } = useI18n()
  const Icon = taskStatusIcons[props.task.status]
  const canCancel =
    props.task.status === CronTaskStatus.Pending ||
    props.task.status === CronTaskStatus.Running
  const canRetry =
    props.task.status === CronTaskStatus.Failed ||
    props.task.status === CronTaskStatus.Cancelled
  const canDelete = [
    CronTaskStatus.Cancelled,
    CronTaskStatus.Completed,
    CronTaskStatus.Failed,
    CronTaskStatus.PartialFailed,
  ].includes(props.task.status)

  return (
    <div className="group flex items-center gap-3 border-b border-neutral-100 px-3 py-2.5 last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
      <Icon
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0',
          taskStatusIconClassNames[props.task.status],
        )}
      />
      <button
        className="outline-hidden flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        onClick={props.onOpen}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-fg-muted">
            {props.task.progressMessage || props.task.id}
          </div>
          <div className="mt-0.5 text-xs tabular-nums text-fg-subtle">
            {formatRelativeDate(props.task.createdAt, t)}
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 text-fg-subtle transition-colors group-hover:text-fg-muted"
        />
      </button>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {canCancel ? (
          <button
            aria-label={t('cron.detail.cancel')}
            className="outline-hidden inline-flex size-7 items-center justify-center rounded text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
            disabled={props.busy}
            onClick={props.onCancel}
            title={t('cron.detail.cancel')}
            type="button"
          >
            <XCircle aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
        {canRetry ? (
          <button
            aria-label={t('cron.detail.retry')}
            className="outline-hidden inline-flex size-7 items-center justify-center rounded text-neutral-600 transition-colors hover:bg-neutral-200 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            disabled={props.busy}
            onClick={props.onRetry}
            title={t('cron.detail.retry')}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            aria-label={t('cron.detail.delete')}
            className="outline-hidden inline-flex size-7 items-center justify-center rounded text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
            disabled={props.busy}
            onClick={props.onDelete}
            title={t('cron.detail.delete')}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

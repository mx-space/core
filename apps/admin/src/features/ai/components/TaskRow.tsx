import { Layers } from 'lucide-react'
import type { AITask } from '~/api/ai'
import type { ListRowSelectMode } from '~/ui/list-actions'

import { AITaskStatus } from '~/api/ai'
import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

import {
  statusIcon,
  taskStatusLabelKeys,
  taskTypeLabelKeys,
} from '../constants'
import {
  formatRelativeTimestamp,
  getEffectiveStatus,
  getTaskProgressLabel,
  getTaskSummary,
  isBatchTask,
  statusIconClassName,
} from '../utils/ai'

const statusDotClassName: Record<AITaskStatus, string> = {
  [AITaskStatus.Pending]: 'bg-neutral-300 dark:bg-neutral-600',
  [AITaskStatus.Running]: 'bg-blue-500',
  [AITaskStatus.Completed]: 'bg-emerald-500',
  [AITaskStatus.PartialFailed]: 'bg-amber-500',
  [AITaskStatus.Failed]: 'bg-red-500',
  [AITaskStatus.Cancelled]: 'bg-neutral-400 dark:bg-neutral-500',
}

const statusTextClassName: Record<AITaskStatus, string> = {
  [AITaskStatus.Pending]: 'text-neutral-500 dark:text-neutral-400',
  [AITaskStatus.Running]: 'text-blue-600 dark:text-blue-400',
  [AITaskStatus.Completed]: 'text-emerald-600 dark:text-emerald-400',
  [AITaskStatus.PartialFailed]: 'text-amber-600 dark:text-amber-400',
  [AITaskStatus.Failed]: 'text-red-600 dark:text-red-400',
  [AITaskStatus.Cancelled]: 'text-neutral-500 dark:text-neutral-400',
}

export function TaskRow(props: {
  task: AITask
  selected: boolean
  onSelect: (mode: ListRowSelectMode) => void
}) {
  const { t } = useI18n()
  const task = props.task
  const effectiveStatus = getEffectiveStatus(task)
  const Icon = statusIcon[effectiveStatus]
  const progressLabel = getTaskProgressLabel(task)

  return (
    <ListRow
      ariaCurrent={props.selected}
      className={cn(
        'group block cursor-default border-b border-neutral-100 px-4 py-2.5 last:border-b-0 dark:border-neutral-800/50',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
      )}
      dataId={task.id}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0',
            effectiveStatus === AITaskStatus.Running && 'animate-spin',
            statusIconClassName(effectiveStatus),
          )}
        />
        <span className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {t(taskTypeLabelKeys[task.type])}
        </span>
        {isBatchTask(task) ? (
          <Layers
            aria-hidden="true"
            className="size-3 shrink-0 text-blue-500"
          />
        ) : null}
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            statusTextClassName[effectiveStatus],
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              statusDotClassName[effectiveStatus],
            )}
          />
          {t(taskStatusLabelKeys[effectiveStatus])}
        </span>
        {task.retryCount > 0 ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {t('ai.task.retryBadge', { count: task.retryCount })}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
          {formatRelativeTimestamp(task.createdAt)}
        </span>
      </div>
      <div className="pl-5.5 mt-1 flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {getTaskSummary(task, t)}
        </p>
        {progressLabel ? (
          <span className="shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
            {progressLabel}
          </span>
        ) : null}
      </div>
    </ListRow>
  )
}

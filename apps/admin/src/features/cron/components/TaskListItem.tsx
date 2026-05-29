import type { CronTask } from '~/api/cron-tasks'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

import {
  taskStatusIconClassNames,
  taskStatusIcons,
  taskTypeLabelKeys,
} from '../constants'
import { formatRelativeDate } from '../utils/cron'
import { StatusBadge } from './CronPrimitives'

export function TaskListItem(props: {
  onSelect: () => void
  selected: boolean
  task: CronTask
}) {
  const { t } = useI18n()
  const Icon = taskStatusIcons[props.task.status]

  return (
    <ListRow
      ariaCurrent={props.selected}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors dark:border-neutral-800',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
      )}
      dataId={props.task.id}
      onSelect={props.onSelect}
      role="option"
      selected={props.selected}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0',
          taskStatusIconClassNames[props.task.status],
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {taskTypeLabelKeys[props.task.type]
            ? t(taskTypeLabelKeys[props.task.type])
            : props.task.type}
        </div>
        <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {props.task.progressMessage || props.task.id}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge status={props.task.status} />
        <div className="mt-1 text-xs tabular-nums text-neutral-400">
          {formatRelativeDate(props.task.createdAt, t)}
        </div>
      </div>
    </ListRow>
  )
}

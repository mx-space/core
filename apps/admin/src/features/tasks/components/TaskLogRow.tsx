import type { AITaskLog } from '~/api/tasks'
import { cn } from '~/utils/cn'

import { formatAbsoluteTimestamp } from '../utils/tasks'

export function TaskLogRow(props: { log: AITaskLog }) {
  return (
    <div className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[9rem_4rem_minmax(0,1fr)]">
      <time className="tabular-nums text-fg-subtle">
        {formatAbsoluteTimestamp(props.log.timestamp)}
      </time>
      <span
        className={cn(
          'font-medium uppercase',
          props.log.level === 'error' && 'text-red-600 dark:text-red-400',
          props.log.level === 'warn' && 'text-amber-600 dark:text-amber-400',
          props.log.level === 'info' && 'text-fg-muted',
        )}
      >
        {props.log.level}
      </span>
      <span className="min-w-0 break-words text-fg-muted">
        {props.log.message}
      </span>
    </div>
  )
}

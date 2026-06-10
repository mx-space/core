import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router'

import type { AITask } from '~/api/tasks'
import { AITaskStatus, getTasksByGroupId } from '~/api/tasks'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { cn } from '~/utils/cn'

import { statusIcon, taskStatusLabelKeys } from '../constants'
import { useTaskGroupSubscription } from '../hooks/useTaskSubscription'
import { getProgress, statusIconClassName } from '../utils/tasks'
import { TaskCostBadge } from './TaskCostBadge'
import { StatusBadge } from './TaskPrimitives'

export function SubTaskList(props: { groupId: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  useTaskGroupSubscription(props.groupId)

  const childrenQuery = useQuery({
    queryFn: () => getTasksByGroupId(props.groupId),
    queryKey: adminQueryKeys.tasks.tasksByGroup(props.groupId),
  })

  if (childrenQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-fg-muted">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        <span>{t('tasks.task.stream.waiting')}</span>
      </div>
    )
  }

  if (childrenQuery.isError) {
    return (
      <div className="px-3 py-4 text-xs text-red-600 dark:text-red-400">
        {t('tasks.subTaskList.loadFailed')}
      </div>
    )
  }

  const children = childrenQuery.data ?? []

  if (children.length === 0) {
    return (
      <div className="rounded border border-dashed border-border px-3 py-4 text-xs text-fg-muted">
        {t('tasks.subTaskList.empty')}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded border border-border">
      {children.map((child) => (
        <SubTaskRow
          key={child.id}
          onOpen={() => navigate(`/tasks/${child.id}`)}
          task={child}
        />
      ))}
    </ul>
  )
}

function SubTaskRow(props: { onOpen: () => void; task: AITask }) {
  const { t } = useI18n()
  const { task, onOpen } = props
  const Icon = statusIcon[task.status]
  const isRunning = task.status === AITaskStatus.Running
  const progress = getProgress(task)
  const lang = getChildLangLabel(task, t)

  return (
    <li>
      <button
        className={cn(
          'flex w-full items-center gap-3 bg-transparent px-3 py-2 text-left transition-colors',
          'hover:bg-surface-inset/50',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent/40',
        )}
        onClick={onOpen}
        type="button"
      >
        <Icon
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0',
            isRunning && 'animate-spin',
            statusIconClassName(task.status),
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-fg">{lang}</span>
        <StatusBadge status={task.status}>
          {t(taskStatusLabelKeys[task.status])}
        </StatusBadge>
        {progress !== null ? (
          <div className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-surface-inset">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
              }}
            />
          </div>
        ) : null}
        {task.tokensGenerated && task.tokensGenerated > 0 ? (
          <span className="hidden shrink-0 text-xs tabular-nums text-fg-subtle sm:inline dark:text-fg-muted">
            {t('tasks.task.tokensGenerated', { count: task.tokensGenerated })}
          </span>
        ) : null}
        <TaskCostBadge className="shrink-0" cost={task.cost} />
      </button>
    </li>
  )
}

function getChildLangLabel(
  task: AITask,
  t: (key: 'tasks.subTaskList.untitledLang') => string,
): string {
  const payload = task.payload as
    | { lang?: unknown; targetLanguages?: unknown }
    | undefined
  if (payload) {
    if (typeof payload.lang === 'string' && payload.lang) return payload.lang
    if (Array.isArray(payload.targetLanguages)) {
      const langs = payload.targetLanguages.filter(
        (v): v is string => typeof v === 'string',
      )
      if (langs.length > 0) return langs.join(', ')
    }
  }
  return t('tasks.subTaskList.untitledLang')
}

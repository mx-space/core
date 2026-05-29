import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import type { CronTask } from '~/api/cron-tasks'
import { findInListCache } from '~/api/list-cache'

import { taskQueryKey } from '../constants'
import { TaskDetailEmptyState } from './CronPrimitives'
import { useHistoryRouteContext } from './history-route-context'
import { TaskDetail } from './TaskDetail'

export function HistoryDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useHistoryRouteContext()

  const task = id
    ? findInListCache<CronTask>(queryClient, taskQueryKey, id)
    : undefined

  if (!id || !task) return <TaskDetailEmptyState />

  return (
    <TaskDetail
      onBack={ctx.onBack}
      onCancel={() => ctx.onCancel(task.id)}
      onDelete={() => ctx.onDelete(task.id)}
      onRetry={() => ctx.onRetry(task.id)}
      task={task}
    />
  )
}

export default HistoryDetailRoute

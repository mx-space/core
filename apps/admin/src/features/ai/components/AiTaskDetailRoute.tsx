import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import type { AITask } from '~/api/ai'
import { getAiTask } from '~/api/ai'
import { findInListCache } from '~/api/list-cache'
import { adminQueryKeys } from '~/query/keys'

import { aiTasksQueryKey } from '../constants'
import { useAiTasksRouteContext } from './ai-tasks-route-context'
import { TaskDetail } from './TaskDetail'
import { TaskDetailEmpty } from './TaskStates'

export function AiTaskDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useAiTasksRouteContext()

  const initialTask = id
    ? findInListCache<AITask>(queryClient, aiTasksQueryKey, id)
    : undefined

  const taskQuery = useQuery({
    enabled: Boolean(id),
    initialData: initialTask,
    queryFn: () => getAiTask(id!),
    queryKey: adminQueryKeys.ai.taskDetail(id ?? ''),
    refetchInterval: 5000,
    staleTime: initialTask ? 5_000 : 0,
  })

  if (!id || !taskQuery.data) return <TaskDetailEmpty />

  return (
    <TaskDetail
      canceling={ctx.canceling}
      deleting={ctx.deleting}
      onBack={ctx.onBack}
      onCancel={ctx.onCancel}
      onDelete={ctx.onDelete}
      onRetry={ctx.onRetry}
      polling={ctx.polling}
      retrying={ctx.retrying}
      task={taskQuery.data}
    />
  )
}

export default AiTaskDetailRoute

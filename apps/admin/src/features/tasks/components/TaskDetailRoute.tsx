import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import type { AITask } from '~/api/tasks'
import { AITaskType, getTask } from '~/api/tasks'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { adminQueryKeys } from '~/query/keys'

import {
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
  tasksQueryKey,
} from '../constants'
import {
  useTaskDetailSubscription,
  useTaskGroupSubscription,
} from '../hooks/useTaskSubscription'
import { TaskDetail } from './TaskDetail'
import { useTasksRouteContext } from './tasks-route-context'
import { TaskDetailEmpty } from './TaskStates'

const GROUP_PARENT_TYPES = new Set<AITaskType>([
  AITaskType.TranslationBatch,
  AITaskType.TranslationAll,
])

export function TaskDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useTasksRouteContext()

  const initialTask = id
    ? findInListCache<AITask>(queryClient, tasksQueryKey, id)
    : undefined

  const { socketConnected } = useTaskDetailSubscription(id)
  const taskQuery = useQuery({
    enabled: Boolean(id),
    initialData: initialTask,
    queryFn: () => getTask(id!),
    queryKey: adminQueryKeys.tasks.taskDetail(id ?? ''),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
    staleTime: initialTask ? 5_000 : 0,
  })

  // Only TranslationBatch / TranslationAll are real parent groups. A
  // plain Translation is itself a child of TranslationBatch / All, not
  // a group parent — do NOT subscribe to its group room.
  const groupSubscribeId =
    id && taskQuery.data && GROUP_PARENT_TYPES.has(taskQuery.data.type)
      ? id
      : null
  useTaskGroupSubscription(groupSubscribeId)

  useDocumentTitle(taskQuery.data?.type)

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

export default TaskDetailRoute

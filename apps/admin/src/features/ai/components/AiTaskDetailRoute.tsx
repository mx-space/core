import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import type { AITask } from '~/api/ai'
import { AITaskType, getAiTask } from '~/api/ai'
import { findInListCache } from '~/api/list-cache'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { adminQueryKeys } from '~/query/keys'

import {
  aiTasksQueryKey,
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
} from '../constants'
import {
  useAiTaskDetailSubscription,
  useAiTaskGroupSubscription,
} from '../hooks/useAiTaskSubscription'
import { useAiTasksRouteContext } from './ai-tasks-route-context'
import { TaskDetail } from './TaskDetail'
import { TaskDetailEmpty } from './TaskStates'

const GROUP_PARENT_TYPES = new Set<AITaskType>([
  AITaskType.TranslationBatch,
  AITaskType.TranslationAll,
])

export function AiTaskDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useAiTasksRouteContext()

  const initialTask = id
    ? findInListCache<AITask>(queryClient, aiTasksQueryKey, id)
    : undefined

  const { socketConnected } = useAiTaskDetailSubscription(id)
  const taskQuery = useQuery({
    enabled: Boolean(id),
    initialData: initialTask,
    queryFn: () => getAiTask(id!),
    queryKey: adminQueryKeys.ai.taskDetail(id ?? ''),
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
  useAiTaskGroupSubscription(groupSubscribeId)

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

export default AiTaskDetailRoute

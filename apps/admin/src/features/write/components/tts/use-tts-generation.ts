import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { createTtsTask, getTtsByRefId } from '~/api/ai'
import { AITaskStatus, getTask } from '~/api/tasks'
import {
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
} from '~/features/tasks/constants'
import { useTaskDetailSubscription } from '~/features/tasks/hooks/useTaskSubscription'
import { getProgress } from '~/features/tasks/utils/tasks'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

type TtsRunStatus = 'failed' | 'idle' | 'running' | 'succeeded'

interface UseTtsGenerationParams {
  enabled: boolean
  refId?: string
}

export function useTtsGeneration(params: UseTtsGenerationParams) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [activeLang, setActiveLang] = useState<null | string>(null)
  const [pendingTaskId, setPendingTaskId] = useState<null | string>(null)
  const [runStatus, setRunStatus] = useState<TtsRunStatus>('idle')
  const [runError, setRunError] = useState<string | undefined>()

  const refId = params.refId
  const canFetch = params.enabled && Boolean(refId)

  // The write route keeps refId in useSearchParams rather than a route param
  // that would force a remount, so switching articles reuses this hook
  // instance — reset every run-scoped state or a stale banner/task would be
  // attributed to the newly selected article.
  useEffect(() => {
    setOpen(false)
    setActiveLang(null)
    setPendingTaskId(null)
    setRunStatus('idle')
    setRunError(undefined)
  }, [refId])

  const rowsQuery = useQuery({
    enabled: canFetch,
    queryFn: () => getTtsByRefId(refId!),
    queryKey: adminQueryKeys.ai.ttsByRef(refId ?? ''),
  })
  const rows = rowsQuery.data ?? []

  useEffect(() => {
    if (activeLang && rows.some((row) => row.lang === activeLang)) return
    setActiveLang(rows[0]?.lang ?? null)
  }, [rows, activeLang])

  const activeRow = rows.find((row) => row.lang === activeLang) ?? null

  const createTaskMutation = useMutation({
    mutationFn: createTtsTask,
    onError: (error) => {
      const message = getErrorMessage(
        error,
        t('write.ttsGeneration.toast.generateFailed'),
      )
      setRunStatus('failed')
      setRunError(message)
      toast.error(message)
    },
    onSuccess: (result) => setPendingTaskId(result.taskId),
  })

  const { socketConnected } = useTaskDetailSubscription(pendingTaskId)
  const taskQuery = useQuery({
    enabled: Boolean(pendingTaskId),
    queryFn: () => getTask(pendingTaskId!),
    queryKey: adminQueryKeys.tasks.taskDetail(pendingTaskId ?? ''),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
    refetchIntervalInBackground: true,
  })

  // Without this the poll dying (task pruned from the queue, network drop) would
  // leave pendingTaskId set forever, and with it a permanently disabled panel.
  useEffect(() => {
    if (!pendingTaskId || !taskQuery.isError) return
    const message = getErrorMessage(
      taskQuery.error,
      t('write.ttsGeneration.toast.generateFailed'),
    )
    setRunStatus('failed')
    setRunError(message)
    toast.error(message)
    setPendingTaskId(null)
  }, [taskQuery.isError, taskQuery.error, pendingTaskId, t])

  useEffect(() => {
    const task = taskQuery.data
    if (!task || !pendingTaskId || task.id !== pendingTaskId) return
    if (
      task.status === AITaskStatus.Pending ||
      task.status === AITaskStatus.Running
    ) {
      return
    }

    if (task.status === AITaskStatus.Completed) {
      setRunStatus('succeeded')
    } else {
      const message =
        task.error ?? t('write.ttsGeneration.toast.generateFailed')
      setRunStatus('failed')
      setRunError(message)
      toast.error(message)
    }

    void queryClient.invalidateQueries({
      queryKey: adminQueryKeys.ai.ttsByRef(refId ?? ''),
    })
    setPendingTaskId(null)
  }, [taskQuery.data, pendingTaskId, refId, queryClient, t])

  const activeTask =
    taskQuery.data && pendingTaskId && taskQuery.data.id === pendingTaskId
      ? taskQuery.data
      : null
  const isRunning = createTaskMutation.isPending || Boolean(pendingTaskId)

  const runTask = (force: boolean) => {
    if (!refId || isRunning) return
    setRunStatus('running')
    setRunError(undefined)
    createTaskMutation.mutate({ force, refId })
  }

  return {
    activeLang,
    activeRow,
    closeDrawer: () => setOpen(false),
    generate: () => runTask(false),
    isLoading: rowsQuery.isLoading,
    isRunning,
    open,
    openDrawer: () => setOpen(true),
    progress: activeTask ? getProgress(activeTask) : null,
    progressMessage: activeTask?.progressMessage,
    regenerate: () => runTask(true),
    rows,
    runError,
    runStatus,
    setActiveLang,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

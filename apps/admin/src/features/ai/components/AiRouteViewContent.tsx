import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { AITask, AITaskType } from '~/api/ai'
import {
  AITaskStatus,
  cancelAiTask,
  deleteAiTask,
  deleteAiTasks,
  getAiTasks,
  retryAiTask,
} from '~/api/ai'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import type { HeaderAction } from '~/ui/layout/page-layout'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { SelectField } from '~/ui/primitives/select'

import {
  aiTasksQueryKey,
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
  pageSize,
  typeOptionKeys,
} from '../constants'
import { useAiTaskListSubscription } from '../hooks/useAiTaskSubscription'
import {
  getErrorMessage,
  readPositivePage,
  readTaskStatusFilter,
  readTaskTypeFilter,
} from '../utils/ai'
import { AiTasksRouteContext } from './ai-tasks-route-context'
import { TaskListPane } from './TaskListPane'
import { TaskDetailEmpty } from './TaskStates'

const TASKS_BASE_PATH = '/ai/tasks'

interface AiTasksUrlState {
  page: number
  status: AITaskStatus | ''
  type: AITaskType | ''
}

function writeAiTasksUrlState(state: AiTasksUrlState) {
  const params = new URLSearchParams()
  if (state.page > 1) params.set('page', String(state.page))
  if (state.status) params.set('status', state.status)
  if (state.type) params.set('type', state.type)
  return params
}

export function AiRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): AiTasksUrlState => ({
        page: readPositivePage(searchParams.get('page')),
        status: readTaskStatusFilter(searchParams.get('status')),
        type: readTaskTypeFilter(searchParams.get('type')),
      }),
      write: writeAiTasksUrlState,
    }),
    [],
  )
  const [listState, setListState] = useUrlListState(urlStateOptions)

  const { page, status: statusFilter, type: typeFilter } = listState

  const queryParams = {
    page,
    size: pageSize,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  }

  const { socketConnected } = useAiTaskListSubscription()
  const tasksQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getAiTasks(queryParams),
    queryKey: adminQueryKeys.ai.tasks(queryParams),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
  })

  const tasks = tasksQuery.data?.data ?? []
  const total = tasksQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const invalidateTasks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: aiTasksQueryKey })
  }, [queryClient])

  const buildListSearch = useCallback(
    (state: AiTasksUrlState = listState) => {
      const next = writeAiTasksUrlState(state)
      const qs = next.toString()
      return qs ? `?${qs}` : ''
    },
    [listState],
  )

  const closeDetail = useCallback(() => {
    navigate(`${TASKS_BASE_PATH}${buildListSearch()}`)
  }, [buildListSearch, navigate])

  const openTask = useCallback(
    (id: string) => {
      navigate(`${TASKS_BASE_PATH}/${id}${buildListSearch()}`)
    },
    [buildListSearch, navigate],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      setListState({ page: nextPage })
    },
    [setListState],
  )

  const handleStatusChange = useCallback(
    (next: AITaskStatus | '') => {
      setListState((current) => ({ ...current, page: 1, status: next }))
    },
    [setListState],
  )

  const handleTypeChange = useCallback(
    (next: AITaskType | '') => {
      setListState((current) => ({ ...current, page: 1, type: next }))
    },
    [setListState],
  )

  const retryMutation = useMutation({
    mutationFn: retryAiTask,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.tasks.toast.retryFailed'))),
    onSuccess: async (result) => {
      toast.success(
        result.created
          ? t('ai.tasks.toast.retryCreated')
          : t('ai.tasks.toast.taskExists'),
      )
      await invalidateTasks()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelAiTask,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.tasks.toast.cancelFailed'))),
    onSuccess: invalidateTasks,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAiTask,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.tasks.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.tasks.toast.deleted'))
      closeDetail()
      await invalidateTasks()
    },
  })

  const clearCompletedMutation = useMutation({
    mutationFn: () =>
      deleteAiTasks({
        before: Date.now(),
        status: AITaskStatus.Completed,
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.tasks.toast.clearFailed'))),
    onSuccess: async (result) => {
      toast.success(t('ai.tasks.toast.cleared', { count: result.deleted }))
      await invalidateTasks()
    },
  })

  const typeOptions = useMemo(
    () =>
      typeOptionKeys.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )

  const typeSelector = (
    <div className="w-40">
      <SelectField
        aria-label={t('ai.filter.typeAria')}
        onValueChange={handleTypeChange}
        options={typeOptions}
        value={typeFilter}
      />
    </div>
  )

  const livePausedNode = !socketConnected ? (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
      title={t('ai.task.live_paused')}
    >
      <CloudOff aria-hidden="true" className="size-3.5" />
      <span className="hidden lg:inline">{t('ai.task.live_paused')}</span>
    </span>
  ) : null

  const headerActions: HeaderAction[] = [
    ...(livePausedNode
      ? [
          {
            kind: 'custom' as const,
            node: livePausedNode,
            mobileNode: livePausedNode,
          },
        ]
      : []),
    {
      kind: 'custom',
      node: typeSelector,
      mobileNode: (
        <div className="w-32">
          <SelectField
            aria-label={t('ai.filter.typeAria')}
            onValueChange={handleTypeChange}
            options={typeOptions}
            value={typeFilter}
          />
        </div>
      ),
    },
    {
      kind: 'button',
      iconOnly: true,
      icon: RefreshCw,
      label: t('ai.action.refresh'),
      onClick: () => void tasksQuery.refetch(),
      disabled: tasksQuery.isFetching,
    },
    {
      kind: 'button',
      iconOnly: true,
      icon: Trash2,
      label: t('ai.action.clearCompleted'),
      onClick: () => {
        if (window.confirm(t('ai.confirm.clearCompleted'))) {
          clearCompletedMutation.mutate()
        }
      },
      disabled: clearCompletedMutation.isPending,
    },
  ]

  const routeContextValue = useMemo(
    () => ({
      canceling: cancelMutation.isPending,
      deleting: deleteMutation.isPending,
      onBack: closeDetail,
      onCancel: (task: AITask) => {
        if (window.confirm(t('ai.confirm.cancelTask', { id: task.id }))) {
          cancelMutation.mutate(task.id)
        }
      },
      onDelete: (task: AITask) => {
        if (window.confirm(t('ai.confirm.deleteTask', { id: task.id }))) {
          deleteMutation.mutate(task.id)
        }
      },
      onRetry: (task: AITask) => retryMutation.mutate(task.id),
      polling: !tasksQuery.isPaused,
      retrying: retryMutation.isPending,
    }),
    [
      cancelMutation,
      closeDetail,
      deleteMutation,
      retryMutation,
      t,
      tasksQuery.isPaused,
    ],
  )

  return (
    <AppPage>
      <PageHeader
        actions={headerActions}
        description={
          total > 0
            ? t('ai.tasks.countSuffix', { count: total })
            : t('routes.aiTasks.description')
        }
        title={t('routes.aiTasks.title')}
      />

      <AiTasksRouteContext.Provider value={routeContextValue}>
        <MasterDetailShell
          emptyDetail={
            <section className="h-full min-h-0">
              <TaskDetailEmpty />
            </section>
          }
          list={
            <TaskListPane
              isError={tasksQuery.isError}
              isLoading={tasksQuery.isLoading}
              onPageChange={setPage}
              onRefetch={() => void tasksQuery.refetch()}
              onSelectTask={openTask}
              onStatusChange={handleStatusChange}
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              selectedTaskId={detailId}
              status={statusFilter}
              tasks={tasks}
              type={typeFilter}
            />
          }
        />
      </AiTasksRouteContext.Provider>
    </AppPage>
  )
}

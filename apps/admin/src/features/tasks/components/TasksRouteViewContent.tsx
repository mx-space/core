import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { getCronTaskDefinitions } from '~/api/cron-tasks'
import type { AITask, TaskScope } from '~/api/tasks'
import {
  AITaskStatus,
  cancelTask,
  deleteTask,
  deleteTasks,
  getTasks,
  retryTask,
} from '~/api/tasks'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import type { HeaderAction } from '~/ui/layout/page-layout'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'

import type { TaskStatusCategory } from '../constants'
import {
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
  pageSize,
  scopeOptionKeys,
  statusCategoryStatuses,
  tasksQueryKey,
  typeOptionKeys,
} from '../constants'
import { useTaskListSubscription } from '../hooks/useTaskSubscription'
import {
  getErrorMessage,
  readPositivePage,
  readTaskStatusFilter,
  readTaskTypeFilter,
} from '../utils/tasks'
import type { TaskTypeOption } from './TaskListPane'
import { TaskListPane } from './TaskListPane'
import { TasksRouteContext } from './tasks-route-context'
import { TaskDetailEmpty } from './TaskStates'

const TASKS_BASE_PATH = '/tasks'

interface TasksUrlState {
  page: number
  scope: TaskScope | ''
  status: TaskStatusCategory | ''
  type: string
}

function readScopeFilter(value: null | string): TaskScope | '' {
  return scopeOptionKeys.some((option) => option.value === value)
    ? (value as TaskScope | '')
    : ''
}

function writeTasksUrlState(state: TasksUrlState) {
  const params = new URLSearchParams()
  if (state.page > 1) params.set('page', String(state.page))
  if (state.scope) params.set('scope', state.scope)
  if (state.status) params.set('status', state.status)
  if (state.type) params.set('type', state.type)
  return params
}

export function TasksRouteView() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): TasksUrlState => ({
        page: readPositivePage(searchParams.get('page')),
        scope: readScopeFilter(searchParams.get('scope')),
        status: readTaskStatusFilter(searchParams.get('status')),
        type: readTaskTypeFilter(searchParams.get('type')),
      }),
      write: writeTasksUrlState,
    }),
    [],
  )
  const [listState, setListState] = useUrlListState(urlStateOptions)

  const {
    page,
    scope: scopeFilter,
    status: statusFilter,
    type: typeFilter,
  } = listState

  const queryParams = {
    page,
    scope: scopeFilter || undefined,
    size: pageSize,
    status: statusFilter ? statusCategoryStatuses[statusFilter] : undefined,
    type: typeFilter || undefined,
  }

  const { socketConnected } = useTaskListSubscription()
  const tasksQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getTasks(queryParams),
    queryKey: adminQueryKeys.tasks.tasks(queryParams),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
  })

  const tasks = tasksQuery.data?.data ?? []
  const total = tasksQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const invalidateTasks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: tasksQueryKey })
  }, [queryClient])

  const buildListSearch = useCallback(
    (state: TasksUrlState = listState) => {
      const next = writeTasksUrlState(state)
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

  const handleScopeChange = useCallback(
    (next: TaskScope | '') => {
      setListState((current) => ({
        ...current,
        page: 1,
        scope: next,
        type: '',
      }))
    },
    [setListState],
  )

  const handleStatusChange = useCallback(
    (next: TaskStatusCategory | '') => {
      setListState((current) => ({ ...current, page: 1, status: next }))
    },
    [setListState],
  )

  const handleTypeChange = useCallback(
    (next: string) => {
      setListState((current) => ({ ...current, page: 1, type: next }))
    },
    [setListState],
  )

  const cronDefinitionsQuery = useQuery({
    enabled: scopeFilter === 'cron',
    queryFn: getCronTaskDefinitions,
    queryKey: adminQueryKeys.cron.definitions(),
    staleTime: 5 * 60 * 1000,
  })

  const retryMutation = useMutation({
    mutationFn: retryTask,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('tasks.toast.retryFailed'))),
    onSuccess: async (result) => {
      toast.success(
        result.created
          ? t('tasks.toast.retryCreated')
          : t('tasks.toast.taskExists'),
      )
      await invalidateTasks()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelTask,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('tasks.toast.cancelFailed'))),
    onSuccess: invalidateTasks,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('tasks.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('tasks.toast.deleted'))
      closeDetail()
      await invalidateTasks()
    },
  })

  const clearCompletedMutation = useMutation({
    mutationFn: () =>
      deleteTasks({
        before: Date.now(),
        scope: scopeFilter || undefined,
        status: AITaskStatus.Completed,
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('tasks.toast.clearFailed'))),
    onSuccess: async (result) => {
      toast.success(t('tasks.toast.cleared', { count: result.deleted }))
      await invalidateTasks()
    },
  })

  const typeOptions = useMemo<TaskTypeOption[] | null>(() => {
    if (scopeFilter === 'ai') {
      return typeOptionKeys.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      }))
    }
    if (scopeFilter === 'cron') {
      const definitions = cronDefinitionsQuery.data ?? []
      if (definitions.length === 0) return null
      return [
        { label: t('tasks.filter.allType'), value: '' },
        ...definitions.map((definition) => ({
          label: definition.name,
          value: definition.type,
        })),
      ]
    }
    return null
  }, [cronDefinitionsQuery.data, scopeFilter, t])

  const headerActions: HeaderAction[] = [
    {
      kind: 'button',
      iconOnly: true,
      icon: RefreshCw,
      label: t('tasks.action.refresh'),
      onClick: () => void tasksQuery.refetch(),
      disabled: tasksQuery.isFetching,
    },
    {
      kind: 'button',
      iconOnly: true,
      icon: Trash2,
      label: t('tasks.action.clearCompleted'),
      onClick: () => {
        if (window.confirm(t('tasks.confirm.clearCompleted'))) {
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
        if (window.confirm(t('tasks.confirm.cancelTask', { id: task.id }))) {
          cancelMutation.mutate(task.id)
        }
      },
      onDelete: (task: AITask) => {
        if (window.confirm(t('tasks.confirm.deleteTask', { id: task.id }))) {
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
        description={t('routes.tasks.description')}
        title={t('routes.tasks.title')}
      />

      <TasksRouteContext.Provider value={routeContextValue}>
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
              livePaused={!socketConnected}
              onPageChange={setPage}
              onRefetch={() => void tasksQuery.refetch()}
              onScopeChange={handleScopeChange}
              onSelectTask={openTask}
              onStatusChange={handleStatusChange}
              onTypeChange={handleTypeChange}
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              scope={scopeFilter}
              selectedTaskId={detailId}
              status={statusFilter}
              tasks={tasks}
              total={total}
              type={typeFilter}
              typeOptions={typeOptions}
            />
          }
        />
      </TasksRouteContext.Provider>
    </AppPage>
  )
}

export default TasksRouteView

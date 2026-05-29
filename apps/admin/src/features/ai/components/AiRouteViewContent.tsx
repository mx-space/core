import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
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
import { useI18n } from '~/i18n'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import type { HeaderAction } from '~/ui/layout/page-layout'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { SelectField } from '~/ui/primitives/select'

import { aiTasksQueryKey, pageSize, typeOptionKeys } from '../constants'
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

export function AiRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter = readTaskStatusFilter(searchParams.get('status'))
  const typeFilter = readTaskTypeFilter(searchParams.get('type'))
  const page = readPositivePage(searchParams.get('page'))

  const queryParams = {
    page,
    size: pageSize,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  }

  const tasksQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getAiTasks(queryParams),
    queryKey: [...aiTasksQueryKey, queryParams],
    refetchInterval: 5000,
  })

  const tasks = tasksQuery.data?.data ?? []
  const total = tasksQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const invalidateTasks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: aiTasksQueryKey })
  }, [queryClient])

  const buildListSearch = useCallback(
    (mutate?: (sp: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams)
      mutate?.(next)
      const qs = next.toString()
      return qs ? `?${qs}` : ''
    },
    [searchParams],
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

  const updateListParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams)
      if (value) next.set(key, value)
      else next.delete(key)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      updateListParam('page', nextPage > 1 ? String(nextPage) : null)
    },
    [updateListParam],
  )

  const handleStatusChange = useCallback(
    (next: AITaskStatus | '') => {
      const sp = new URLSearchParams(searchParams)
      if (next) sp.set('status', next)
      else sp.delete('status')
      sp.delete('page')
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const handleTypeChange = useCallback(
    (next: AITaskType | '') => {
      const sp = new URLSearchParams(searchParams)
      if (next) sp.set('type', next)
      else sp.delete('type')
      sp.delete('page')
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
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

  const headerActions: HeaderAction[] = [
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

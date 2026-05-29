import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { AITaskType } from '~/api/ai'
import type { HeaderAction } from '~/ui/layout/page-layout'

import {
  AITaskStatus,
  cancelAiTask,
  deleteAiTask,
  deleteAiTasks,
  getAiTasks,
  retryAiTask,
} from '~/api/ai'
import { useI18n } from '~/i18n'
import {
  AppPage,
  MasterDetailLayout,
  PageHeader,
} from '~/ui/layout/page-layout'
import { SelectField } from '~/ui/primitives/select'

import { aiTasksQueryKey, pageSize, typeOptionKeys } from '../constants'
import {
  getErrorMessage,
  readPositivePage,
  readTaskStatusFilter,
  readTaskTypeFilter,
} from '../utils/ai'
import { TaskDetail } from './TaskDetail'
import { TaskListPane } from './TaskListPane'
import { TaskDetailEmpty } from './TaskStates'

export function AiRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [statusFilter, setStatusFilter] = useState<AITaskStatus | ''>(
    readTaskStatusFilter(searchParams.get('status')),
  )
  const [typeFilter, setTypeFilter] = useState<AITaskType | ''>(
    readTaskTypeFilter(searchParams.get('type')),
  )
  const [page, setPage] = useState(readPositivePage(searchParams.get('page')))
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get('id'),
  )
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(
    Boolean(searchParams.get('id')),
  )

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
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  useLayoutEffect(() => {
    const nextStatus = readTaskStatusFilter(searchParams.get('status'))
    const nextType = readTaskTypeFilter(searchParams.get('type'))
    const nextPage = readPositivePage(searchParams.get('page'))
    const nextSelectedId = searchParams.get('id')

    setStatusFilter((value) => (value === nextStatus ? value : nextStatus))
    setTypeFilter((value) => (value === nextType ? value : nextType))
    setPage((value) => (value === nextPage ? value : nextPage))
    setSelectedTaskId((value) =>
      value === nextSelectedId ? value : nextSelectedId,
    )
    setShowDetailOnMobile(Boolean(nextSelectedId))
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (statusFilter) next.set('status', statusFilter)
    else next.delete('status')
    if (typeFilter) next.set('type', typeFilter)
    else next.delete('type')
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    if (selectedTaskId) next.set('id', selectedTaskId)
    else next.delete('id')

    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
  }, [
    page,
    searchParams,
    searchParamsKey,
    selectedTaskId,
    setSearchParams,
    statusFilter,
    typeFilter,
  ])

  useEffect(() => {
    if (
      selectedTaskId &&
      !selectedTask &&
      tasksQuery.isSuccess &&
      !tasksQuery.isFetching
    ) {
      setSelectedTaskId(null)
      setShowDetailOnMobile(false)
    }
  }, [
    selectedTask,
    selectedTaskId,
    tasksQuery.isFetching,
    tasksQuery.isSuccess,
  ])

  const invalidateTasks = async () => {
    await queryClient.invalidateQueries({ queryKey: aiTasksQueryKey })
  }

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
      setSelectedTaskId(null)
      setShowDetailOnMobile(false)
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

  const handleStatusChange = (next: AITaskStatus | '') => {
    setStatusFilter(next)
    setPage(1)
  }
  const handleTypeChange = (next: AITaskType | '') => {
    setTypeFilter(next)
    setPage(1)
  }
  const handleSelectTask = (id: string) => {
    setSelectedTaskId(id)
    setShowDetailOnMobile(true)
  }

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

      <MasterDetailLayout
        showDetailOnMobile={showDetailOnMobile}
        list={
          <TaskListPane
            isError={tasksQuery.isError}
            isLoading={tasksQuery.isLoading}
            onPageChange={setPage}
            onRefetch={() => void tasksQuery.refetch()}
            onSelectTask={handleSelectTask}
            onStatusChange={handleStatusChange}
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            selectedTaskId={selectedTaskId}
            status={statusFilter}
            tasks={tasks}
            type={typeFilter}
          />
        }
        detail={
          <section className="h-full min-h-0">
            {selectedTask ? (
              <TaskDetail
                canceling={cancelMutation.isPending}
                deleting={deleteMutation.isPending}
                onBack={() => setShowDetailOnMobile(false)}
                onCancel={(task) => {
                  if (
                    window.confirm(t('ai.confirm.cancelTask', { id: task.id }))
                  ) {
                    cancelMutation.mutate(task.id)
                  }
                }}
                onDelete={(task) => {
                  if (
                    window.confirm(t('ai.confirm.deleteTask', { id: task.id }))
                  ) {
                    deleteMutation.mutate(task.id)
                  }
                }}
                onRetry={(task) => retryMutation.mutate(task.id)}
                polling={!tasksQuery.isPaused}
                retrying={retryMutation.isPending}
                task={selectedTask}
              />
            ) : (
              <TaskDetailEmpty />
            )}
          </section>
        }
      />
    </AppPage>
  )
}

import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { CronTaskStatus, CronTaskType, getCronTasks } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  statusOptionKeys,
  taskListPageSize,
  taskQueryKey,
  taskRefetchInterval,
  typeOptionKeys,
} from '../constants'
import { useCronMutations } from '../hooks/useCronMutations'
import {
  Select,
  TaskDetailEmptyState,
  TaskEmptyState,
  TaskListSkeleton,
} from './CronPrimitives'
import { TaskDetail } from './TaskDetail'
import { TaskListItem } from './TaskListItem'

const FOCUS_SCOPE_ID = 'cron-history'

const STATUS_VALUES = new Set<string>(Object.values(CronTaskStatus))
const TYPE_VALUES = new Set<string>(Object.values(CronTaskType))

export function HistoryRouteViewContent() {
  const { t } = useI18n()
  const { cancel, clearCompleted, refreshAll, remove, retry } =
    useCronMutations()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)

  const statusFilter = parseStatus(searchParams.get('status'))
  const typeFilter = parseType(searchParams.get('type'))
  const selectedTaskId = searchParams.get('taskId')

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setStatusFilter = (value?: CronTaskStatus) => {
    updateParams((params) => {
      if (value) params.set('status', value)
      else params.delete('status')
      params.delete('taskId')
    })
  }
  const setTypeFilter = (value?: CronTaskType) => {
    updateParams((params) => {
      if (value) params.set('type', value)
      else params.delete('type')
      params.delete('taskId')
    })
  }
  const setSelectedTaskId = (value: string | null) => {
    updateParams((params) => {
      if (value) params.set('taskId', value)
      else params.delete('taskId')
    })
  }

  const statusOptions = statusOptionKeys.map((opt) => ({
    label: opt.labelKey ? t(opt.labelKey) : (opt.labelText ?? opt.value),
    value: opt.value,
  }))
  const typeOptions = typeOptionKeys.map((opt) => ({
    label: opt.labelKey ? t(opt.labelKey) : (opt.labelText ?? opt.value),
    value: opt.value,
  }))

  const tasksQuery = useQuery({
    queryFn: () =>
      getCronTasks({
        page: 1,
        size: taskListPageSize,
        status: statusFilter,
        type: typeFilter,
      }),
    queryKey: [...taskQueryKey, 'history', { statusFilter, typeFilter }],
    refetchInterval: taskRefetchInterval,
  })

  const tasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data])
  const total = tasksQuery.data?.total ?? 0
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  useEffect(() => {
    if (selectedTaskId && !selectedTask && !tasksQuery.isLoading) {
      setShowDetailOnMobile(false)
    } else if (selectedTaskId) {
      setShowDetailOnMobile(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, selectedTask, tasksQuery.isLoading])

  useListKeyboard({
    actions: [],
    getId: (task) => task.id,
    items: tasks,
    onItemFocus: (id) => setSelectedTaskId(id),
    resetOn: [statusFilter, typeFilter],
    scopeId: FOCUS_SCOPE_ID,
  })

  const selectTask = (taskId: string) => {
    setSelectedTaskId(taskId)
    setShowDetailOnMobile(true)
  }

  return (
    <MasterDetailLayout
      detail={
        <section className="h-full min-h-0">
          {selectedTask ? (
            <TaskDetail
              onBack={() => setShowDetailOnMobile(false)}
              onCancel={() => {
                if (window.confirm(t('cron.detail.confirmCancel'))) {
                  cancel.mutate(selectedTask.id)
                }
              }}
              onDelete={() => {
                if (window.confirm(t('cron.detail.confirmDelete'))) {
                  remove.mutate(selectedTask.id, {
                    onSuccess: () => {
                      setSelectedTaskId(null)
                      setShowDetailOnMobile(false)
                    },
                  })
                }
              }}
              onRetry={() => retry.mutate(selectedTask.id)}
              task={selectedTask}
            />
          ) : (
            <TaskDetailEmptyState />
          )}
        </section>
      }
      list={
        <FocusScope
          className="outline-hidden flex h-full min-h-0 flex-col"
          id={FOCUS_SCOPE_ID}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
              APP_SHELL_HEADER_HEIGHT_CLASS,
            )}
          >
            <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
              <span className="truncate">{t('cron.history.title')}</span>
              <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                {total}
              </span>
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                aria-label={t('cron.action.clearCompleted')}
                disabled={clearCompleted.isPending}
                iconOnly
                onClick={() => clearCompleted.mutate()}
                type="button"
                variant="subtle"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label={t('common.refresh')}
                disabled={tasksQuery.isFetching}
                iconOnly
                onClick={() => void refreshAll()}
                type="button"
                variant="subtle"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    'size-4',
                    tasksQuery.isFetching && 'animate-spin',
                  )}
                />
              </Button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Select
              ariaLabel={t('cron.filter.statusAria')}
              onChange={(value) =>
                setStatusFilter(
                  (value || undefined) as CronTaskStatus | undefined,
                )
              }
              options={statusOptions}
              value={statusFilter ?? ''}
            />
            <Select
              ariaLabel={t('cron.filter.typeAria')}
              onChange={(value) =>
                setTypeFilter((value || undefined) as CronTaskType | undefined)
              }
              options={typeOptions}
              value={typeFilter ?? ''}
            />
          </div>

          <Scroll className="flex-1">
            {tasksQuery.isLoading && tasks.length === 0 ? (
              <TaskListSkeleton />
            ) : tasks.length === 0 ? (
              <TaskEmptyState />
            ) : (
              tasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  onSelect={() => selectTask(task.id)}
                  selected={selectedTaskId === task.id}
                  task={task}
                />
              ))
            )}
          </Scroll>
        </FocusScope>
      }
      showDetailOnMobile={showDetailOnMobile}
    />
  )
}

function parseStatus(raw: string | null): CronTaskStatus | undefined {
  if (raw && STATUS_VALUES.has(raw)) return raw as CronTaskStatus
  return undefined
}

function parseType(raw: string | null): CronTaskType | undefined {
  if (raw && TYPE_VALUES.has(raw)) return raw as CronTaskType
  return undefined
}

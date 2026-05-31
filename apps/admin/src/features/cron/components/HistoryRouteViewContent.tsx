import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { CronTaskStatus, CronTaskType, getCronTasks } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  statusOptionKeys,
  taskListPageSize,
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
import { HistoryRouteContext } from './history-route-context'
import { TaskListItem } from './TaskListItem'

const FOCUS_SCOPE_ID = 'cron-history'
const HISTORY_BASE_PATH = '/maintenance/cron/history'

const STATUS_VALUES = new Set<string>(Object.values(CronTaskStatus))
const TYPE_VALUES = new Set<string>(Object.values(CronTaskType))

export function HistoryRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const { cancel, clearCompleted, refreshAll, remove, retry } =
    useCronMutations()
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams) => ({
        statusFilter: parseStatus(searchParams.get('status')),
        typeFilter: parseType(searchParams.get('type')),
      }),
      write: (state: {
        statusFilter?: CronTaskStatus
        typeFilter?: CronTaskType
      }) => buildHistorySearchParams(state.statusFilter, state.typeFilter),
    }),
    [],
  )
  const [filterState, setFilterState] = useUrlListState(urlStateOptions)
  const statusFilter = filterState.statusFilter
  const typeFilter = filterState.typeFilter
  const listQueryString = urlStateOptions.write(filterState).toString()

  const buildListSearch = useCallback(
    (nextState = filterState) => {
      const qs = urlStateOptions.write(nextState).toString()
      return qs ? `?${qs}` : ''
    },
    [filterState, urlStateOptions],
  )

  const updateFilter = useCallback(
    (key: 'status' | 'type', value: string | undefined) => {
      const nextState = {
        ...filterState,
        [key === 'status' ? 'statusFilter' : 'typeFilter']:
          key === 'status'
            ? parseStatus(value ?? null)
            : parseType(value ?? null),
      }
      setFilterState(nextState)
      // Filter change closes detail and resets to list root.
      navigate(`${HISTORY_BASE_PATH}${buildListSearch(nextState)}`, {
        replace: true,
      })
    },
    [buildListSearch, filterState, navigate, setFilterState],
  )

  const closeDetail = useCallback(() => {
    navigate(
      `${HISTORY_BASE_PATH}${listQueryString ? `?${listQueryString}` : ''}`,
    )
  }, [listQueryString, navigate])

  const openTask = useCallback(
    (id: string) => {
      navigate(
        `${HISTORY_BASE_PATH}/${id}${listQueryString ? `?${listQueryString}` : ''}`,
      )
    },
    [listQueryString, navigate],
  )

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
    queryKey: adminQueryKeys.cron.history({
      status: statusFilter,
      type: typeFilter,
    }),
    refetchInterval: taskRefetchInterval,
  })

  const tasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data])
  const total = tasksQuery.data?.total ?? 0

  useListKeyboard({
    actions: [],
    getId: (task) => task.id,
    items: tasks,
    onItemFocus: (id) => openTask(id),
    resetOn: [statusFilter, typeFilter],
    scopeId: FOCUS_SCOPE_ID,
  })

  const routeContextValue = useMemo(
    () => ({
      onBack: closeDetail,
      onCancel: (taskId: string) => {
        if (window.confirm(t('cron.detail.confirmCancel'))) {
          cancel.mutate(taskId)
        }
      },
      onDelete: (taskId: string) => {
        if (window.confirm(t('cron.detail.confirmDelete'))) {
          remove.mutate(taskId, {
            onSuccess: () => {
              closeDetail()
            },
          })
        }
      },
      onRetry: (taskId: string) => retry.mutate(taskId),
    }),
    [cancel, closeDetail, remove, retry, t],
  )

  return (
    <HistoryRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
        emptyDetail={<TaskDetailEmptyState />}
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
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
                  <span className="truncate">{t('cron.history.title')}</span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {total}
                  </span>
                </h2>
              </div>
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
                onChange={(value) => updateFilter('status', value || undefined)}
                options={statusOptions}
                value={statusFilter ?? ''}
              />
              <Select
                ariaLabel={t('cron.filter.typeAria')}
                onChange={(value) => updateFilter('type', value || undefined)}
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
                    onSelect={() => openTask(task.id)}
                    selected={detailId === task.id}
                    task={task}
                  />
                ))
              )}
            </Scroll>
          </FocusScope>
        }
      />
    </HistoryRouteContext.Provider>
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

function buildHistorySearchParams(
  statusFilter?: CronTaskStatus,
  typeFilter?: CronTaskType,
) {
  const nextParams = new URLSearchParams()
  if (statusFilter) nextParams.set('status', statusFilter)
  if (typeFilter) nextParams.set('type', typeFilter)
  return nextParams
}

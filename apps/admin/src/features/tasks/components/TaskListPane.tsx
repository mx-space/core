import { CloudOff } from 'lucide-react'
import { useMemo } from 'react'

import type { AITask, TaskScope } from '~/api/tasks'
import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { FocusScope } from '~/ui/focus-scope'
import { useListKeyboard } from '~/ui/list-actions'
import { Scroll } from '~/ui/primitives/scroll'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { SelectField } from '~/ui/primitives/select'

import type { TaskStatusCategory } from '../constants'
import { scopeOptionKeys, statusCategoryOptionKeys } from '../constants'
import { TaskRow } from './TaskRow'
import { TasksEmpty, TasksError, TasksSkeleton } from './TaskStates'

const SCOPE_ID = 'tasks'
const ALL_TAB_KEY = 'all'

export interface TaskTypeOption {
  label: string
  value: string
}

interface TaskListPaneProps {
  tasks: AITask[]
  selectedTaskId: string | null
  scope: TaskScope | ''
  status: TaskStatusCategory | ''
  type: string
  typeOptions: TaskTypeOption[] | null
  livePaused: boolean
  total: number
  page: number
  pageCount: number
  pageSize: number
  isLoading: boolean
  isError: boolean
  onRefetch: () => void
  onSelectTask: (id: string) => void
  onScopeChange: (scope: TaskScope | '') => void
  onStatusChange: (status: TaskStatusCategory | '') => void
  onTypeChange: (type: string) => void
  onPageChange: (page: number) => void
}

export function TaskListPane(props: TaskListPaneProps) {
  const { t } = useI18n()

  useListKeyboard({
    scopeId: SCOPE_ID,
    items: props.tasks,
    getId: (task) => task.id,
    resetOn: [props.scope, props.status, props.type, props.page],
    onItemFocus: (id) => props.onSelectTask(id),
    actions: [
      {
        key: 'open',
        label: 'Open',
        shortcut: 'Enter',
        run: (targets) => {
          const target = targets[0]
          if (target) props.onSelectTask(target.id)
        },
      },
    ],
  })

  const scopeTabs = useMemo(
    () =>
      scopeOptionKeys.map((option) => ({
        label: t(option.labelKey),
        value: option.value || ALL_TAB_KEY,
      })),
    [t],
  )

  const statusOptions = useMemo(
    () =>
      statusCategoryOptionKeys.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col"
      id={SCOPE_ID}
    >
      <div className="shrink-0 px-3 pt-2">
        <SegmentedControl
          aria-label={t('tasks.filter.scopeTabsAria')}
          className="-mx-1 w-[calc(100%+0.5rem)]"
          fill
          onValueChange={(key) =>
            props.onScopeChange(key === ALL_TAB_KEY ? '' : (key as TaskScope))
          }
          options={scopeTabs}
          value={props.scope || ALL_TAB_KEY}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-24 max-w-36 flex-1">
          <SelectField
            aria-label={t('tasks.filter.statusAria')}
            onValueChange={props.onStatusChange}
            options={statusOptions}
            value={props.status}
          />
        </div>
        {props.typeOptions ? (
          <div className="min-w-24 max-w-36 flex-1">
            <SelectField
              aria-label={t('tasks.filter.typeAria')}
              onValueChange={props.onTypeChange}
              options={props.typeOptions}
              value={props.type}
            />
          </div>
        ) : null}
        <span className="flex-1" />
        {props.livePaused ? (
          <span
            aria-live="polite"
            className="inline-flex shrink-0 items-center text-amber-600 dark:text-amber-400"
            title={t('tasks.task.live_paused')}
          >
            <CloudOff aria-hidden="true" className="size-3.5" />
          </span>
        ) : null}
        <span className="shrink-0 text-xs tabular-nums text-fg-muted">
          {t('tasks.countSuffix', { count: props.total })}
        </span>
      </div>

      <Scroll className="flex-1">
        {props.isLoading && props.tasks.length === 0 ? (
          <TasksSkeleton />
        ) : props.isError ? (
          <TasksError onRetry={props.onRefetch} />
        ) : props.tasks.length === 0 ? (
          <TasksEmpty />
        ) : (
          props.tasks.map((task) => (
            <TaskRow
              key={task.id}
              onSelect={() => props.onSelectTask(task.id)}
              selected={props.selectedTaskId === task.id}
              showScope={!props.scope}
              task={task}
            />
          ))
        )}
      </Scroll>

      {props.pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-2">
          <span className="text-xs tabular-nums text-fg-muted">
            {t('tasks.page.pageIndex', { page: props.page })}
          </span>
          <CompactPagination
            onPageChange={props.onPageChange}
            onPageSizeChange={() => undefined}
            page={props.page}
            pageCount={props.pageCount}
            pageSize={props.pageSize}
            pageSizes={[props.pageSize]}
          />
        </div>
      ) : null}
    </FocusScope>
  )
}

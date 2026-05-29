import type { AITask, AITaskStatus, AITaskType } from '~/api/ai'

import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { FocusScope } from '~/ui/focus-scope'
import { useListKeyboard } from '~/ui/list-actions'
import { Scroll } from '~/ui/primitives/scroll'

import { TaskFilterChips } from './TaskFilterChips'
import { TaskRow } from './TaskRow'
import { TasksEmpty, TasksError, TasksSkeleton } from './TaskStates'

const SCOPE_ID = 'ai-tasks'

interface TaskListPaneProps {
  tasks: AITask[]
  selectedTaskId: string | null
  status: AITaskStatus | ''
  type: AITaskType | ''
  page: number
  pageCount: number
  pageSize: number
  isLoading: boolean
  isError: boolean
  onRefetch: () => void
  onSelectTask: (id: string) => void
  onStatusChange: (status: AITaskStatus | '') => void
  onPageChange: (page: number) => void
}

export function TaskListPane(props: TaskListPaneProps) {
  const { t } = useI18n()

  useListKeyboard({
    scopeId: SCOPE_ID,
    items: props.tasks,
    getId: (task) => task.id,
    resetOn: [props.status, props.type, props.page],
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

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col"
      id={SCOPE_ID}
    >
      <TaskFilterChips
        onStatusChange={props.onStatusChange}
        status={props.status}
      />

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
              task={task}
            />
          ))
        )}
      </Scroll>

      {props.pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {t('ai.page.pageIndex', { page: props.page })}
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

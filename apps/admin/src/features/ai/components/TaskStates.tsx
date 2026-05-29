import { ListTodo } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function TasksSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="px-4 py-3" key={index}>
          <div className="h-4 w-2/5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="mt-3 h-3 w-3/5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      ))}
    </div>
  )
}

export function TasksError(props: { onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('ai.empty.tasksLoadFailed')}
      </p>
      <Button className="mt-3" onClick={props.onRetry} type="button">
        {t('ai.action.retry')}
      </Button>
    </div>
  )
}

export function TasksEmpty() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <ListTodo aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('ai.empty.tasks')}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {t('ai.empty.tasksDescription')}
      </p>
    </div>
  )
}

export function TaskDetailEmpty() {
  const { t } = useI18n()

  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <ListTodo aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {t('ai.empty.tasksDetail')}
      </p>
    </div>
  )
}

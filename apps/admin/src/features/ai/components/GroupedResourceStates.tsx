import { ListTodo } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function GroupedResourceSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="grid gap-4 px-4 py-4 lg:grid-cols-[18rem_minmax(0,1fr)]"
          key={index}
        >
          <div>
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
            <div className="mt-3 h-4 w-48 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
          <div className="h-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      ))}
    </div>
  )
}

export function ResourceError(props: { onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('ai.empty.dataLoadFailed')}
      </p>
      <Button className="mt-3" onClick={props.onRetry} type="button">
        {t('ai.action.retry')}
      </Button>
    </div>
  )
}

export function ResourceEmpty(props: { label: string }) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <ListTodo aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('ai.empty.label', { label: props.label })}
      </p>
    </div>
  )
}

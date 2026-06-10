import { ListTodo } from 'lucide-react'
import type { ReactNode } from 'react'

import type { CronTaskLog, CronTaskStatus } from '~/api/cron-tasks'
import { useI18n } from '~/i18n'
import { Badge } from '~/ui/primitives/badge'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import { taskStatusLabelKeys, taskStatusTones } from '../constants'
import type { SelectOption } from '../types/cron'
import { formatLogTime } from '../utils/cron'

export function StatusBadge(props: { status: CronTaskStatus }) {
  const { t } = useI18n()
  return (
    <Badge tone={taskStatusTones[props.status]}>
      {t(taskStatusLabelKeys[props.status])}
    </Badge>
  )
}

export function Select(props: {
  ariaLabel: string
  onChange: (value: string) => void
  options: SelectOption[]
  value: string
}) {
  return (
    <SelectField
      aria-label={props.ariaLabel}
      onValueChange={props.onChange}
      options={props.options}
      value={props.value}
    />
  )
}

export function DetailSection(props: {
  children: ReactNode
  title: ReactNode
}) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {props.title}
      </h3>
      {props.children}
    </section>
  )
}

export function MetadataRow(props: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <dt className="text-neutral-500 dark:text-neutral-400">{props.label}</dt>
      <dd>
        <code className="break-all rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {props.value}
        </code>
      </dd>
    </div>
  )
}

export function LogLine(props: { log: CronTaskLog }) {
  const levelClassNames: Record<CronTaskLog['level'], string> = {
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    warn: 'text-amber-600 dark:text-amber-400',
  }

  return (
    <div className="flex gap-2 font-mono text-xs leading-5">
      <span className="shrink-0 text-neutral-400">
        {formatLogTime(props.log.timestamp)}
      </span>
      <span className={cn('shrink-0', levelClassNames[props.log.level])}>
        [{props.log.level.toUpperCase()}]
      </span>
      <span className="min-w-0 break-words text-neutral-700 dark:text-neutral-300">
        {props.log.message}
      </span>
    </div>
  )
}

export function DefinitionSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          className="h-11 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
          key={index}
        />
      ))}
    </div>
  )
}

export function TaskListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="h-16 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
          key={index}
        />
      ))}
    </div>
  )
}

export function TaskEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <ListTodo
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('cron.empty.list')}
      </p>
    </div>
  )
}

export function TaskDetailEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center px-6 text-center">
      <ListTodo
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('cron.empty.detail')}
      </p>
    </div>
  )
}

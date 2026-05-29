import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ListTodo, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import type { CronTask, CronTaskDefinition } from '~/api/cron-tasks'

import { getCronTasks } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  taskQueryKey,
  taskRefetchInterval,
  taskTypeLabelKeys,
} from '../constants'
import { useCronMutations } from '../hooks/useCronMutations'
import { formatDateTime, formatNullableDate } from '../utils/cron'
import { DefinitionRunRow } from './DefinitionRunRow'

const RECENT_RUNS_LIMIT = 10

export function DefinitionDetail(props: {
  definition: CronTaskDefinition
  onBack: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { cancel, remove, retry, run } = useCronMutations()
  const definition = props.definition
  const label = definition.description || t(taskTypeLabelKeys[definition.type])

  const recentRunsQuery = useQuery({
    queryFn: () =>
      getCronTasks({ page: 1, size: RECENT_RUNS_LIMIT, type: definition.type }),
    queryKey: [...taskQueryKey, { type: definition.type }],
    refetchInterval: taskRefetchInterval,
  })

  const runs: CronTask[] = recentRunsQuery.data?.data ?? []
  const total = recentRunsQuery.data?.total ?? 0

  const busy =
    cancel.isPending || retry.isPending || remove.isPending || run.isPending

  const handleRun = () => {
    if (window.confirm(t('cron.definitions.confirmRun'))) {
      run.mutate(definition.type)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {label}
            </h2>
            <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {definition.type}
            </p>
          </div>
        </div>
        <Button
          disabled={run.isPending}
          onClick={handleRun}
          type="button"
          variant="primary"
        >
          <Play aria-hidden="true" className="size-4" />
          {t('cron.definitions.run')}
        </Button>
      </div>

      <Scroll className="flex-1" innerClassName="px-5 py-4 space-y-5">
        <section>
          <dl className="grid gap-2 text-xs">
            <Row label={t('cron.definitions.cronExpression')}>
              <code className="break-all rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                {definition.cronExpression}
              </code>
            </Row>
            <Row label={t('cron.definitions.nextDate')}>
              {formatNullableDate(definition.nextDate, t)}
            </Row>
            {definition.lastDate ? (
              <Row label={t('cron.definitions.lastDate')}>
                {formatDateTime(definition.lastDate)}
              </Row>
            ) : null}
            <Row label={t('cron.detail.meta.type')}>
              <code className="break-all rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                {definition.type}
              </code>
            </Row>
          </dl>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('cron.definitions.recentRuns')}
              <span className="ml-1 tabular-nums text-neutral-500">
                ({total})
              </span>
            </h3>
            {total > 0 ? (
              <Link
                className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-950 hover:underline dark:text-neutral-400 dark:hover:text-neutral-50"
                to={`/maintenance/cron/history?type=${encodeURIComponent(definition.type)}`}
              >
                {t('cron.definitions.viewAll')}
              </Link>
            ) : null}
          </div>

          {recentRunsQuery.isLoading && runs.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
                  key={index}
                />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded border border-dashed border-neutral-200 px-4 text-center dark:border-neutral-800">
              <ListTodo
                aria-hidden="true"
                className="mb-2 size-8 text-neutral-300 dark:text-neutral-700"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('cron.definitions.recentRunsEmpty')}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-neutral-200 dark:border-neutral-800">
              {runs.map((task) => (
                <DefinitionRunRow
                  busy={busy}
                  key={task.id}
                  onCancel={() => {
                    if (window.confirm(t('cron.detail.confirmCancel'))) {
                      cancel.mutate(task.id)
                    }
                  }}
                  onDelete={() => {
                    if (window.confirm(t('cron.detail.confirmDelete'))) {
                      remove.mutate(task.id)
                    }
                  }}
                  onOpen={() => {
                    const params = new URLSearchParams()
                    params.set('type', definition.type)
                    params.set('taskId', task.id)
                    navigate(`/maintenance/cron/history?${params.toString()}`)
                  }}
                  onRetry={() => retry.mutate(task.id)}
                  task={task}
                />
              ))}
            </div>
          )}
        </section>
      </Scroll>
    </div>
  )
}

function Row(props: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
      <dt className="text-neutral-500 dark:text-neutral-400">{props.label}</dt>
      <dd className="min-w-0 text-neutral-800 dark:text-neutral-200">
        {props.children}
      </dd>
    </div>
  )
}

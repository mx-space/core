import { ArrowLeft, ListTodo, Play } from 'lucide-react'
import { Link } from 'react-router'

import type { CronTaskDefinition } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { taskTypeLabelKeys } from '../constants'
import { useCronMutations } from '../hooks/useCronMutations'
import { formatDateTime, formatNullableDate } from '../utils/cron'

export function DefinitionDetail(props: {
  definition: CronTaskDefinition
  onBack: () => void
}) {
  const { t } = useI18n()
  const { run } = useCronMutations()
  const definition = props.definition
  const label = definition.description || t(taskTypeLabelKeys[definition.type])

  const handleRun = () => {
    if (window.confirm(t('cron.definitions.confirmRun'))) {
      run.mutate(definition.type)
    }
  }

  const runsHref = `/tasks?scope=cron&type=${encodeURIComponent(definition.type)}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <MobileHeaderAffordance />
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
          <Link
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-card px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-inset"
            to={runsHref}
          >
            <ListTodo aria-hidden="true" className="size-4" />
            {t('cron.definitions.viewRuns')}
          </Link>
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

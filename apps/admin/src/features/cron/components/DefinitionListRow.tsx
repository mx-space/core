import { Play } from 'lucide-react'

import type { CronTaskDefinition } from '~/api/cron-tasks'
import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

import { taskTypeLabelKeys } from '../constants'
import { formatNullableDate } from '../utils/cron'

export function DefinitionListRow(props: {
  definition: CronTaskDefinition
  onRun: () => void
  onSelect: () => void
  running: boolean
  selected: boolean
}) {
  const { t } = useI18n()
  const label =
    props.definition.description || t(taskTypeLabelKeys[props.definition.type])

  return (
    <ListRow
      ariaCurrent={props.selected}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors dark:border-neutral-800',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
      )}
      dataId={props.definition.type}
      onSelect={props.onSelect}
      role="option"
      selected={props.selected}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-900">
            {props.definition.cronExpression}
          </code>
          <span className="truncate">
            {formatNullableDate(props.definition.nextDate, t)}
          </span>
        </div>
      </div>
      <button
        aria-label={t('cron.definitions.runAria', { description: label })}
        className="outline-hidden inline-flex size-8 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
        disabled={props.running}
        onClick={(event) => {
          event.stopPropagation()
          props.onRun()
        }}
        title={t('cron.definitions.run')}
        type="button"
      >
        <Play aria-hidden="true" className="size-4" />
      </button>
    </ListRow>
  )
}

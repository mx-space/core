import type { AiOverviewListRow } from '~/api/ai-overview'
import { AI_OVERVIEW_CAPABILITIES } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { getRefTypeMeta } from '../article-grouped/refTypeMeta'
import { CAPABILITY_META } from './capability-meta'
import { capabilityDotState } from './coverage-cells'

const STATE_CLASS = {
  full: 'text-emerald-600 dark:text-emerald-400',
  partial: 'text-amber-500',
  none: 'text-fg-subtle/30',
} as const

export function OverviewListRow(props: {
  row: AiOverviewListRow
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useI18n()
  const meta = getRefTypeMeta(props.row.article.type)
  const TypeIcon = meta.icon

  return (
    <button
      className={cn(
        'flex w-full flex-col gap-1.5 border-b border-border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
        props.selected ? 'bg-accent-soft' : 'hover:bg-surface-inset',
      )}
      onClick={props.onSelect}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        <TypeIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-fg-subtle"
        />
        <span className="truncate text-sm font-medium text-fg">
          {props.row.article.title}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        {AI_OVERVIEW_CAPABILITIES.map((capability) => {
          const Icon = CAPABILITY_META[capability].icon
          return (
            <Icon
              aria-hidden="true"
              className={cn(
                'size-3.5',
                STATE_CLASS[capabilityDotState(props.row.coverage, capability)],
              )}
              key={capability}
            />
          )
        })}
        <span className="ml-auto text-xs tabular-nums text-fg-subtle">
          {props.row.gapCount
            ? t('ai.overview.gapCount', { count: props.row.gapCount })
            : t('ai.overview.gapNone')}
        </span>
      </span>
    </button>
  )
}

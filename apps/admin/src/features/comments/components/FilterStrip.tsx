import { X } from 'lucide-react'

import type { CommentRefType } from '~/api/comments'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

export type RefTypeFilter = CommentRefType | 'all'

export interface FilterStripProps {
  refType: RefTypeFilter
  onRefTypeChange: (next: RefTypeFilter) => void
  sourceLabel?: string
  onClearSource?: () => void
  total?: number
  totalOf?: number
  rightSlot?: React.ReactNode
}

const REF_TYPES: ReadonlyArray<RefTypeFilter> = ['all', 'post', 'note', 'page']

export function FilterStrip(props: FilterStripProps) {
  const { format, t } = useI18n()

  const totalText = (() => {
    if (props.total == null) return null
    if (props.totalOf != null && props.totalOf !== props.total) {
      return t('comments.filter.totalOf', {
        shown: format.number(props.total),
        total: format.number(props.totalOf),
      })
    }
    return t('comments.list.totalCount', {
      count: format.number(props.total),
    })
  })()

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2"
      data-testid="comments-filter-strip"
    >
      <div className="flex flex-wrap items-center gap-1">
        {REF_TYPES.map((value) => {
          const isActive = props.refType === value
          const label =
            value === 'all'
              ? t('comments.filter.allSources')
              : t(`comments.refType.${value}` as const)
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors',
                'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-fg-muted hover:bg-surface-inset hover:text-fg',
              )}
              data-testid={`comments-reftype-${value}`}
              key={value}
              onClick={() => props.onRefTypeChange(value)}
              type="button"
            >
              {label}
            </button>
          )
        })}

        {props.sourceLabel ? (
          <span
            className="ml-1 inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft px-3 text-xs font-medium text-accent"
            data-testid="comments-source-chip"
          >
            <span className="max-w-[14rem] truncate">{props.sourceLabel}</span>
            {props.onClearSource ? (
              <button
                aria-label={t('comments.filter.clearSource')}
                className="inline-flex size-4 items-center justify-center rounded-full text-accent hover:bg-accent/15 focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
                data-testid="comments-source-chip-clear"
                onClick={props.onClearSource}
                type="button"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>

      {props.rightSlot ? (
        <div className="flex items-center">{props.rightSlot}</div>
      ) : null}

      {totalText ? (
        <span
          className="ml-auto shrink-0 text-xs tabular-nums text-fg-subtle"
          data-testid="comments-filter-total"
        >
          {totalText}
        </span>
      ) : null}
    </div>
  )
}

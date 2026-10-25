import { useI18n } from '~/i18n'
import type { DraftRefType, DraftStorageSummary } from '~/models/draft'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import { filterOptionKeys, relationFilterKeys } from '../constants'
import type { DraftRelationFilter, DraftSort } from '../utils/draft-filter'

const chipClass = (active: boolean) =>
  cn(
    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
    active
      ? 'border-accent bg-accent-soft text-accent'
      : 'border-border-strong text-fg-muted hover:bg-surface-inset',
  )

export function DraftListFilters(props: {
  counts: DraftStorageSummary['relations'] | undefined
  onRelation: (next: DraftRelationFilter) => void
  onSort: (next: DraftSort) => void
  onType: (next: DraftRefType | 'all') => void
  relation: DraftRelationFilter
  sort: DraftSort
  type: DraftRefType | 'all'
}) {
  const { t } = useI18n()
  const countOf = (value: DraftRelationFilter) => {
    if (!props.counts) return null
    if (value === 'in_sync') return props.counts.inSync
    if (value !== 'all') return props.counts[value]
    return props.counts.ahead + props.counts.fresh + props.counts.inSync
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        {filterOptionKeys.map((option) => (
          <button
            aria-pressed={props.type === option.value}
            className={chipClass(props.type === option.value)}
            key={option.value}
            onClick={() => props.onType(option.value)}
            type="button"
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {relationFilterKeys.map((option) => (
          <button
            aria-pressed={props.relation === option.value}
            className={chipClass(props.relation === option.value)}
            key={option.value}
            onClick={() => props.onRelation(option.value)}
            type="button"
          >
            {t(option.labelKey)}
            <span className="ml-1 tabular-nums opacity-75">
              {countOf(option.value) ?? ''}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs text-fg-muted">
          {t('drafts.sort.label')}
          <SelectField<DraftSort>
            aria-label={t('drafts.sort.label')}
            className="h-6 w-auto pl-2 pr-1.5 text-xs"
            onValueChange={props.onSort}
            options={[
              { label: t('drafts.sort.updated'), value: 'updated' },
              { label: t('drafts.sort.size'), value: 'size' },
            ]}
            popupClassName="w-auto min-w-[var(--anchor-width)] text-xs"
            value={props.sort}
          />
        </div>
      </div>
    </div>
  )
}

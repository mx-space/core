import type { EnrichmentProviderMeta } from '~/models/enrichment'
import type {
  CacheFilterMode,
  CaptureSortField,
  EnrichmentSource,
  SortOrder,
} from '../types/enrichment'

import { useI18n } from '~/i18n'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import { SmallBadge } from './EnrichmentPrimitives'

export function SourceSwitcher(props: {
  onChange: (source: EnrichmentSource) => void
  value: EnrichmentSource
}) {
  const { t } = useI18n()
  const items: Array<{ label: string; value: EnrichmentSource }> = [
    { label: t('enrichment.source.cache'), value: 'cache' },
    { label: t('enrichment.source.screenshots'), value: 'screenshots' },
    { label: t('enrichment.source.probe'), value: 'probe' },
  ]

  return (
    <div className="inline-flex w-full items-center gap-1 rounded bg-neutral-100/80 p-1 dark:bg-neutral-800/60">
      {items.map((item) => (
        <button
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors',
            props.value === item.value
              ? 'shadow-xs bg-white text-neutral-950 ring-1 ring-black/[0.04] dark:bg-neutral-700 dark:text-neutral-50 dark:ring-white/10'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
          )}
          key={item.value}
          onClick={() => props.onChange(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function FilterSegment(props: {
  onChange: (mode: CacheFilterMode) => void
  value: CacheFilterMode
}) {
  const { t } = useI18n()
  const items: Array<{ label: string; value: CacheFilterMode }> = [
    { label: t('enrichment.filter.all'), value: 'all' },
    { label: t('enrichment.filter.failed'), value: 'failed' },
  ]

  return (
    <div className="inline-flex items-center gap-0.5 rounded border border-neutral-200 p-0.5 dark:border-neutral-800">
      {items.map((item) => (
        <button
          className={cn(
            'rounded px-2.5 py-1 text-xs transition-colors',
            props.value === item.value
              ? 'bg-neutral-950 text-white dark:bg-neutral-50 dark:text-neutral-950'
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
          )}
          key={item.value}
          onClick={() => props.onChange(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function CaptureControls(props: {
  onOrderChange: (order: SortOrder) => void
  onSortChange: (sort: CaptureSortField) => void
  order: SortOrder
  sort: CaptureSortField
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-2 gap-2">
      <SelectField
        aria-label={t('enrichment.capture.sortAria')}
        onValueChange={props.onSortChange}
        options={[
          {
            label: t('enrichment.capture.sort.lastAccessed'),
            value: 'last_accessed',
          },
          { label: t('enrichment.capture.sort.created'), value: 'created' },
          { label: t('enrichment.capture.sort.bytes'), value: 'bytes' },
        ]}
        value={props.sort}
      />
      <SelectField
        aria-label={t('enrichment.capture.orderAria')}
        onValueChange={props.onOrderChange}
        options={[
          { label: t('enrichment.capture.order.desc'), value: 'desc' },
          { label: t('enrichment.capture.order.asc'), value: 'asc' },
        ]}
        value={props.order}
      />
    </div>
  )
}

export function ProviderStatusBar(props: {
  providers: EnrichmentProviderMeta[]
}) {
  const ready = props.providers.filter((provider) => provider.ready).length

  return (
    <div className="flex flex-wrap gap-2">
      <SmallBadge
        tone={ready === props.providers.length ? 'success' : 'warning'}
      >
        {ready}/{props.providers.length} ready
      </SmallBadge>
      {props.providers.slice(0, 4).map((provider) => (
        <SmallBadge
          key={provider.name}
          tone={provider.ready ? 'success' : 'neutral'}
        >
          {provider.displayName}
        </SmallBadge>
      ))}
    </div>
  )
}

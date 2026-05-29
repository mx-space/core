import type { EnrichmentRow } from '~/models/enrichment'
import type { CacheFilterMode } from '../types/enrichment'

import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { ListEmpty, ListLoading, ProviderBadge } from './EnrichmentPrimitives'

export function CacheListPanel(props: {
  filterMode: CacheFilterMode
  loading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelect: (row: EnrichmentRow) => void
  page: number
  pageCount: number
  pageSize: number
  rows: EnrichmentRow[]
  selectedId: null | string
  total: number
}) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-neutral-200 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {t('enrichment.cache.totalSuffix', { count: props.total })}
      </div>
      <Scroll className="flex-1">
        {props.loading && props.rows.length === 0 ? (
          <ListLoading />
        ) : props.rows.length === 0 ? (
          <ListEmpty
            label={
              props.filterMode === 'failed'
                ? t('enrichment.cache.emptyFailed')
                : t('enrichment.cache.emptyAll')
            }
          />
        ) : (
          props.rows.map((row) => (
            <CacheRow
              key={row.id}
              onSelect={() => props.onSelect(row)}
              row={row}
              selected={props.selectedId === row.id}
            />
          ))
        )}
      </Scroll>
      {props.pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-end border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <CompactPagination
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onPageSizeChange}
            page={props.page}
            pageCount={props.pageCount}
            pageSize={props.pageSize}
          />
        </div>
      ) : null}
    </div>
  )
}

function CacheRow(props: {
  onSelect: () => void
  row: EnrichmentRow
  selected: boolean
}) {
  const { t } = useI18n()
  const row = props.row

  return (
    <button
      className={cn(
        'flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-800/50',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
      )}
      onClick={props.onSelect}
      type="button"
    >
      <ProviderBadge provider={row.provider} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {row.normalized.title || row.url}
        </h3>
        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {row.normalized.category}
          {row.normalized.subtype ? ` · ${row.normalized.subtype}` : ''}
        </p>
        <p className="mt-1 truncate text-xs text-neutral-400">{row.url}</p>
      </div>
      <div className="shrink-0 text-right text-xs tabular-nums text-neutral-400">
        {row.failureCount > 0 ? (
          <span className="text-red-500">
            {t('enrichment.cache.failureCount', { count: row.failureCount })}
          </span>
        ) : (
          relativeTimeFromNow(row.fetchedAt)
        )}
      </div>
    </button>
  )
}

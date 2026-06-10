import { useI18n } from '~/i18n'
import type { EnrichmentCaptureJoinedRow } from '~/models/enrichment'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { formatBytes } from '../utils/enrichment'
import { ListEmpty, ListLoading } from './EnrichmentPrimitives'

export function CaptureListPanel(props: {
  loading: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelect: (row: EnrichmentCaptureJoinedRow) => void
  page: number
  pageCount: number
  pageSize: number
  quota: null | string
  rows: EnrichmentCaptureJoinedRow[]
  selectedId: null | string
  total: number
}) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-1.5 text-xs text-fg-muted">
        <span className="truncate">
          {t('enrichment.capture.totalSuffix', { count: props.total })}
          {props.quota ? ` · ${props.quota}` : ''}
        </span>
        {props.pageCount > 1 ? (
          <CompactPagination
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onPageSizeChange}
            page={props.page}
            pageCount={props.pageCount}
            pageSize={props.pageSize}
            pageSizes={[10, 20, 50]}
          />
        ) : null}
      </div>
      <Scroll className="flex-1">
        {props.loading && props.rows.length === 0 ? (
          <ListLoading />
        ) : props.rows.length === 0 ? (
          <ListEmpty label={t('enrichment.capture.empty')} />
        ) : (
          props.rows.map((row) => (
            <CaptureRow
              key={row.enrichmentId}
              onSelect={() => props.onSelect(row)}
              row={row}
              selected={props.selectedId === row.enrichmentId}
            />
          ))
        )}
      </Scroll>
    </div>
  )
}

function CaptureRow(props: {
  onSelect: () => void
  row: EnrichmentCaptureJoinedRow
  selected: boolean
}) {
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
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
        <img
          alt=""
          className="h-full w-full object-cover"
          src={props.row.publicUrl}
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {props.row.title || props.row.url}
        </h3>
        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {props.row.provider} · {formatBytes(props.row.bytes)} ·{' '}
          {props.row.width} x {props.row.height}
        </p>
        <p className="mt-1 truncate text-xs text-neutral-400">
          {props.row.url}
        </p>
      </div>
    </button>
  )
}

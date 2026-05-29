import type { SearchDocumentAdminRow } from '~/api/search-index'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

import { formatRelativeDate } from '../utils/format'
import { RefTypeBadge } from './RefTypeBadge'
import { SmallBadge } from './SmallBadge'

export function SearchIndexRow(props: {
  onSelect: () => void
  row: SearchDocumentAdminRow
  selected: boolean
}) {
  const { t } = useI18n()
  const row = props.row

  return (
    <ListRow
      ariaCurrent={props.selected}
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-800/50',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
      )}
      dataId={row.id}
      onSelect={props.onSelect}
      role="option"
      selected={props.selected}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <RefTypeBadge refType={row.refType} />
          {row.lang ? <SmallBadge>{row.lang}</SmallBadge> : null}
          {!row.isPublished ? (
            <SmallBadge tone="warning">
              {t('searchIndex.row.unpublished')}
            </SmallBadge>
          ) : null}
          {row.hasPassword ? (
            <SmallBadge>{t('searchIndex.row.password')}</SmallBadge>
          ) : null}
        </div>
        <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {row.title || (
            <span className="text-neutral-400">
              {t('searchIndex.row.untitled')}
            </span>
          )}
        </h3>
        <div className="text-xs tabular-nums text-neutral-400">
          {t('searchIndex.row.titleBodySummary', {
            bodyLen: row.bodyLength,
            titleLen: row.titleLength,
          })}
        </div>
      </div>
      <div className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
        {formatRelativeDate(row.modifiedAt, t)}
      </div>
    </ListRow>
  )
}

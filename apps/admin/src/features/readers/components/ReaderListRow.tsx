import { Crown } from 'lucide-react'

import type { ReaderModel } from '~/api/readers'
import { useI18n } from '~/i18n'
import { StatusPill } from '~/ui/data/StatusPill'
import type { ListRowSelectMode } from '~/ui/list-actions'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

interface ReaderListRowProps {
  reader: ReaderModel
  selected: boolean
  onSelect: (mode: ListRowSelectMode) => void
}

function avatarFallback(reader: ReaderModel) {
  const seed = reader.name || reader.username || reader.handle || reader.id
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=random`
}

export function ReaderListRow(props: ReaderListRowProps) {
  const { t } = useI18n()
  const { reader } = props
  const banned = Boolean(reader.bannedAt)
  const displayName =
    reader.name || reader.username || reader.handle || reader.id

  return (
    <ListRow
      ariaCurrent={props.selected}
      className={cn(
        'group relative flex cursor-default items-center gap-3 border-b border-border px-4 py-3 last:border-b-0',
        'hover:bg-surface-inset',
        'data-selected:bg-accent-soft data-selected:text-fg',
        'data-selected:hover:bg-accent-soft',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent/40',
      )}
      dataId={reader.id}
      onSelect={props.onSelect}
      role="option"
      selected={props.selected}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-0.5 bg-accent',
          props.selected ? 'opacity-100' : 'opacity-0',
        )}
      />
      <img
        alt=""
        className={cn(
          'size-10 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700',
          banned && 'grayscale',
        )}
        src={reader.image || avatarFallback(reader)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-fg">
            {displayName}
          </span>
          {reader.role === 'owner' ? (
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"
              title={t('readers.role.owner')}
            >
              <Crown aria-hidden="true" className="size-2.5" />
            </span>
          ) : null}
          {banned ? (
            <StatusPill className="shrink-0" tone="error">
              {t('readers.row.banned')}
            </StatusPill>
          ) : null}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          {reader.handle ? (
            <span className="shrink-0 truncate">@{reader.handle}</span>
          ) : null}
          {reader.handle && reader.email ? (
            <span aria-hidden="true" className="text-fg-subtle">
              ·
            </span>
          ) : null}
          {reader.email ? (
            <span className="min-w-0 truncate">{reader.email}</span>
          ) : null}
          <span aria-hidden="true" className="text-fg-subtle">
            ·
          </span>
          <span className="shrink-0">
            {reader.lastLoginAt
              ? relativeTimeFromNow(reader.lastLoginAt)
              : t('readers.row.lastLoginNever')}
          </span>
        </div>
      </div>
    </ListRow>
  )
}

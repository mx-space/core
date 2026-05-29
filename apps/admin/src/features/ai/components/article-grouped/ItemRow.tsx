import { Calendar, Trash2 } from 'lucide-react'
import type { ListRowSelectMode } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

import { formatDateString } from '../../utils/ai'

interface ItemRowProps<TItem> {
  item: TItem
  id: string
  lang: string
  createdAt: string
  preview: string
  selected: boolean
  onSelect: (mode: ListRowSelectMode) => void
  onDelete: () => void
  buildMenu: (item: TItem) => ContextMenuItem[]
}

export function ItemRow<TItem>(props: ItemRowProps<TItem>) {
  const { t } = useI18n()
  const menuItems = () => props.buildMenu(props.item)

  return (
    <ListRow
      as="article"
      className={cn(
        'group block cursor-default border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800/50',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
      )}
      dataId={props.id}
      menuItems={menuItems}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            {props.lang.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
            <Calendar aria-hidden="true" className="size-3" />
            {formatDateString(props.createdAt)}
          </span>
        </div>
        <button
          aria-label={t('ai.action.delete')}
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center rounded text-neutral-400 transition-all',
            'group-data-selected:opacity-100 opacity-0 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100',
            'dark:hover:bg-red-950/40 dark:hover:text-red-400',
          )}
          onClick={(event) => {
            event.stopPropagation()
            props.onDelete()
          }}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-neutral-700 dark:text-neutral-300">
        {props.preview || '-'}
      </p>
    </ListRow>
  )
}

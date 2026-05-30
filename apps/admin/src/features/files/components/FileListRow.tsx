import { FileIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import { buildMenuItemsFromActions, ListRow } from '~/ui/list-actions'
import { Badge } from '~/ui/primitives/badge'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

import type { FileRowItem } from '../utils/adapters'
import { isImageByName } from '../utils/isImageMime'
import { FileThumbnail } from './FileThumbnail'

interface FileListRowProps<TRaw> {
  item: FileRowItem<TRaw>
  isDetailTarget: boolean
  selected: boolean
  selectable?: boolean
  checked?: boolean
  onCheck?: (id: string, checked: boolean) => void
  onSelect: (mode: ListRowSelectMode) => void
  actions: ReadonlyArray<ListAction<FileRowItem<TRaw>>>
  trailing?: ReactNode
}

export function FileListRow<TRaw>(props: FileListRowProps<TRaw>) {
  const showImage = isImageByName(props.item.name)
  const menuItems = () => buildMenuItemsFromActions(props.actions, props.item)

  return (
    <ListRow
      as="article"
      ariaCurrent={props.isDetailTarget}
      className={cn(
        'group grid cursor-default grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-border px-4 py-2.5 last:border-b-0',
        'hover:bg-surface-inset',
        'data-popup-open:bg-surface-inset',
        'data-selected:bg-accent-soft data-selected:text-fg',
        'data-selected:hover:bg-accent-soft',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent/40',
      )}
      dataId={props.item.id}
      leading={
        props.selectable ? (
          <Checkbox
            aria-label={props.item.name}
            checked={props.checked ?? false}
            className="mt-3"
            onCheckedChange={(checked) =>
              props.onCheck?.(props.item.id, checked)
            }
          />
        ) : undefined
      }
      menuItems={menuItems}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-9 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
          {showImage ? (
            <FileThumbnail
              alt={props.item.name}
              thumbhash={props.item.thumbhash}
              className="h-full w-full object-cover"
              dominantColor={props.item.palette?.dominant}
              src={props.item.url}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <FileIcon aria-hidden="true" className="size-4 text-fg-subtle" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium text-fg">
              {props.item.primary}
            </h3>
            {props.item.status ? (
              <Badge size="sm" tone={props.item.status.tone}>
                {props.item.status.label}
              </Badge>
            ) : null}
          </div>
          {props.item.secondary || props.item.tertiary ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
              {props.item.secondary ? (
                <span>{props.item.secondary}</span>
              ) : null}
              {props.item.tertiary ? (
                <span className="truncate">{props.item.tertiary}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {props.trailing}
      </div>
    </ListRow>
  )
}

import { FileIcon } from 'lucide-react'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import type { ReactNode } from 'react'
import type { FileRowItem, RowTone } from '../utils/adapters'

import { buildMenuItemsFromActions, ListRow } from '~/ui/list-actions'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

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

const toneClasses: Record<RowTone, string> = {
  neutral:
    'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
}

export function FileListRow<TRaw>(props: FileListRowProps<TRaw>) {
  const showImage = isImageByName(props.item.name)
  const menuItems = () => buildMenuItemsFromActions(props.actions, props.item)

  return (
    <ListRow
      as="article"
      ariaCurrent={props.isDetailTarget}
      className={cn(
        'group grid cursor-default grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0 dark:border-neutral-800/50',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
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
              <FileIcon
                aria-hidden="true"
                className="size-4 text-neutral-400"
              />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {props.item.primary}
            </h3>
            {props.item.status ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-xs',
                  toneClasses[props.item.status.tone],
                )}
              >
                {props.item.status.label}
              </span>
            ) : null}
          </div>
          {props.item.secondary || props.item.tertiary ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
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

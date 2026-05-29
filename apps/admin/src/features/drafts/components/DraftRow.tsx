import type { DraftModel } from '~/models/draft'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'

import { useI18n } from '~/i18n'
import { buildMenuItemsFromActions, ListRow } from '~/ui/list-actions'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { refTypeMeta } from '../constants'

export function DraftRow(props: {
  actions: ReadonlyArray<ListAction<DraftModel>>
  checked: boolean
  draft: DraftModel
  isDetailTarget: boolean
  onCheck: (id: string, checked: boolean) => void
  onSelect: (mode: ListRowSelectMode) => void
  selected: boolean
}) {
  const { t } = useI18n()
  const meta = refTypeMeta[props.draft.refType]
  const Icon = meta.icon
  const title = props.draft.title || t('drafts.row.untitled')

  const menuItems = () => buildMenuItemsFromActions(props.actions, props.draft)

  return (
    <ListRow
      as="article"
      ariaCurrent={props.isDetailTarget}
      className={cn(
        'group grid cursor-default grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800/50',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
      )}
      dataId={props.draft.id}
      leading={
        <Checkbox
          aria-label={t('drafts.list.checkboxAria', { title })}
          checked={props.checked}
          className="mt-1"
          onCheckedChange={(checked) => props.onCheck(props.draft.id, checked)}
        />
      }
      menuItems={menuItems}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs',
            meta.className,
          )}
        >
          <Icon aria-hidden="true" className="size-3" />
          {t(meta.labelKey)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {title}
            </h3>
            <span className="text-xs tabular-nums text-neutral-400">
              v{props.draft.version}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {props.draft.refId
                ? t('drafts.row.editing')
                : t('drafts.row.creating')}
            </span>
            <span>{props.draft.contentFormat ?? 'markdown'}</span>
            <time dateTime={props.draft.updatedAt}>
              {relativeTimeFromNow(props.draft.updatedAt)}
            </time>
          </div>
        </div>
      </div>
    </ListRow>
  )
}

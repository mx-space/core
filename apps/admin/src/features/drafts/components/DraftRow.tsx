import { useI18n } from '~/i18n'
import type { DraftModel } from '~/models/draft'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import { buildMenuItemsFromActions, ListRow } from '~/ui/list-actions'
import { Badge } from '~/ui/primitives/badge'
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
        'group grid cursor-default grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-b border-border px-4 py-3 last:border-b-0',
        'hover:bg-surface-inset',
        'data-popup-open:bg-surface-inset',
        'data-selected:bg-accent-soft data-selected:text-fg',
        'data-selected:hover:bg-accent-soft',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent/40',
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
        <Badge className="mt-0.5" tone={meta.tone}>
          <Icon aria-hidden="true" className="size-3" />
          {t(meta.labelKey)}
        </Badge>
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

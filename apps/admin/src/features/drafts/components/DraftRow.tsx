import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { DraftCard } from '~/models/draft'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import { buildMenuItemsFromActions, ListRow } from '~/ui/list-actions'
import { Badge } from '~/ui/primitives/badge'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { refTypeMeta, relationMeta } from '../constants'

export function DraftRow(props: {
  actions: ReadonlyArray<ListAction<DraftCard>>
  checked: boolean
  cursor?: boolean
  draft: DraftCard
  isDetailTarget: boolean
  onCheck: (id: string, checked: boolean) => void
  onSelect: (mode: ListRowSelectMode) => void
  selected: boolean
}) {
  const { t } = useI18n()
  const meta = refTypeMeta[props.draft.document.refType]
  const Icon = meta.icon
  const title = props.draft.headRevision.title || t('drafts.row.untitled')
  const relation = relationMeta[props.draft.relation]
  const size = props.draft.storage.revisionBytes + props.draft.storage.crdtBytes

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
      cursor={props.cursor}
      dataId={props.draft.id}
      leading={
        <Checkbox
          aria-label={t('drafts.list.checkboxAria', { title })}
          checked={props.checked}
          className="mt-1"
          cursor={props.cursor}
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
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
              {title}
            </h3>
            <span className="shrink-0 text-xs font-medium tabular-nums text-fg">
              {formatBytes(size)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
            <span className={cn('rounded-full px-1.5', relation.className)}>
              {t(relation.labelKey)}
            </span>
            <span>
              {t('drafts.row.versions', {
                count: props.draft.storage.revisionCount,
              })}
            </span>
            {props.draft.storage.crdtBytes > 0 ? (
              <span>{t('drafts.row.hasCrdt')}</span>
            ) : null}
            <time
              className="ml-auto"
              dateTime={props.draft.updatedAt ?? props.draft.createdAt}
            >
              {relativeTimeFromNow(
                props.draft.updatedAt ?? props.draft.createdAt,
              )}
            </time>
          </div>
        </div>
      </div>
    </ListRow>
  )
}

import { Hash } from 'lucide-react'

import { useI18n } from '~/i18n'
import type { TopicModel } from '~/models/topic'
import type { ListAction, ListRowSelectMode } from '~/ui/list-actions'
import { buildMenuItemsFromActions, ListRow } from '~/ui/list-actions'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

import { TopicAvatar } from './TopicAvatar'

export function TopicRow(props: {
  actions: ReadonlyArray<ListAction<TopicModel>>
  checked: boolean
  isDetailTarget: boolean
  onCheck: (id: string, checked: boolean) => void
  onSelect: (mode: ListRowSelectMode) => void
  selected: boolean
  topic: TopicModel
}) {
  const { t } = useI18n()
  const menuItems = () => buildMenuItemsFromActions(props.actions, props.topic)

  return (
    <ListRow
      as="article"
      ariaCurrent={props.isDetailTarget}
      className={cn(
        'group grid cursor-default grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800/60',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
      )}
      dataId={props.topic.id}
      leading={
        <Checkbox
          aria-label={t('topics.list.checkboxAria', { name: props.topic.name })}
          checked={props.checked}
          onCheckedChange={(checked) => props.onCheck(props.topic.id, checked)}
        />
      }
      menuItems={menuItems}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      <div className="flex min-w-0 items-center gap-3">
        <TopicAvatar topic={props.topic} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-fg">
            {props.topic.name}
          </h3>
          <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-fg-subtle">
            <Hash aria-hidden="true" className="size-3 shrink-0" />
            {props.topic.slug}
          </p>
        </div>
      </div>
    </ListRow>
  )
}

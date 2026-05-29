import type { ArticleInfo } from '~/api/ai'
import type { ListRowSelectMode } from '~/ui/list-actions'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

import { getRefTypeMeta } from './refTypeMeta'

interface ArticleListRowProps {
  article: ArticleInfo
  itemCount: number
  isDetailTarget: boolean
  selected: boolean
  onSelect: (mode: ListRowSelectMode) => void
  itemCountKey: Parameters<ReturnType<typeof useI18n>['t']>[0]
}

export function ArticleListRow(props: ArticleListRowProps) {
  const { t } = useI18n()
  const meta = getRefTypeMeta(props.article.type)
  const Icon = meta.icon

  return (
    <ListRow
      as="article"
      ariaCurrent={props.isDetailTarget}
      className={cn(
        'group block cursor-default border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800/50',
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
        'data-popup-open:bg-neutral-100 dark:data-popup-open:bg-neutral-800/60',
        'data-selected:bg-neutral-100 dark:data-selected:bg-neutral-800/60',
        'data-selected:hover:bg-neutral-200/60 dark:data-selected:hover:bg-neutral-800/80',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:focus-visible:outline-neutral-500',
      )}
      dataId={props.article.id}
      onSelect={props.onSelect}
      role="row"
      selected={props.selected}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
        <h3 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {props.article.title || t(meta.labelKey)}
        </h3>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-6">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {t(meta.labelKey)}
        </span>
        <span className="text-xs text-neutral-400">
          {t(props.itemCountKey, { count: props.itemCount })}
        </span>
      </div>
    </ListRow>
  )
}

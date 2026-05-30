import { Tag } from 'lucide-react'

import { useI18n } from '~/i18n'
import type { TagModel } from '~/models/category'
import { cn } from '~/utils/cn'

export function TagRow(props: {
  onSelect: () => void
  selected: boolean
  tag: TagModel
}) {
  const { t } = useI18n()
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors dark:border-neutral-800/60',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
      )}
      onClick={props.onSelect}
      type="button"
    >
      <Tag aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-fg">
          {props.tag.name}
        </h4>
        <p className="mt-0.5 text-xs text-fg-subtle">
          {t('categories.section.tagLabel')}
        </p>
      </div>
      <span className="text-xs tabular-nums text-fg-subtle">
        {props.tag.count}
      </span>
    </button>
  )
}

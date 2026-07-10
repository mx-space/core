import { FolderOpen, Hash } from 'lucide-react'

import type { CategoryEntity } from '~/data/resources/category'
import { cn } from '~/utils/cn'

export function CategoryRow(props: {
  category: CategoryEntity
  onSelect: () => void
  selected: boolean
}) {
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
      <FolderOpen
        aria-hidden="true"
        className="size-4 shrink-0 text-fg-subtle"
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-fg">
          {props.category.name}
        </h4>
        <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-fg-subtle">
          <Hash aria-hidden="true" className="size-3 shrink-0" />
          {props.category.slug}
        </p>
      </div>
      <span className="text-xs tabular-nums text-fg-subtle">
        {props.category.count ?? 0}
      </span>
    </button>
  )
}

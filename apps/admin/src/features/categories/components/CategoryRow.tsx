import { FolderOpen, Hash } from 'lucide-react'
import type { CategoryModel } from '~/models/category'

import { usePostResourceCategory } from '~/data/post-category-resource/hooks'
import { cn } from '~/utils/cn'

export function CategoryRow(props: {
  categoryId: string
  onSelect: () => void
  selected: boolean
}) {
  const category = usePostResourceCategory(props.categoryId) as
    | CategoryModel
    | undefined

  if (!category) return null

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
        className="size-4 shrink-0 text-neutral-400"
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
          {category.name}
        </h4>
        <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-neutral-400">
          <Hash aria-hidden="true" className="size-3 shrink-0" />
          {category.slug}
        </p>
      </div>
      <span className="text-xs tabular-nums text-neutral-400">
        {category.count}
      </span>
    </button>
  )
}

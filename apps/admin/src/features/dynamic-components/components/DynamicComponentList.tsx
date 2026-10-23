import { Code2 } from 'lucide-react'

import { cn } from '~/utils/cn'

import type { DynamicComponentItem } from '../types/dynamic-components'

export function DynamicComponentList(props: {
  items: DynamicComponentItem[]
  onSelect: (item: DynamicComponentItem) => void
  selectedId: string | null
}) {
  return (
    <>
      {props.items.map((item) => (
        <button
          className={cn(
            'flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-900',
            props.selectedId === item.id
              ? 'bg-neutral-100 dark:bg-neutral-900'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
          )}
          key={item.id}
          onClick={() => props.onSelect(item)}
          type="button"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-fg-muted">
            <Code2 aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg">
              {item.name}
            </div>
            <div className="mt-0.5 truncate font-mono text-xs text-fg-subtle">
              {item.url}
            </div>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
            {item.initialHeight}px
          </span>
        </button>
      ))}
    </>
  )
}

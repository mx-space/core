import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export interface ChipOption<V extends string> {
  value: V
  label: ReactNode
  icon?: LucideIcon
}

interface ChipStripProps<V extends string> {
  options: ChipOption<V>[]
  value: V
  onChange: (value: V) => void
  ariaLabel?: string
}

export function ChipStrip<V extends string>(props: ChipStripProps<V>) {
  return (
    <div
      aria-label={props.ariaLabel}
      className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800"
      role="tablist"
    >
      {props.options.map((option) => {
        const active = props.value === option.value
        const Icon = option.icon
        return (
          <button
            aria-selected={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors',
              active
                ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900',
            )}
            key={option.value}
            onClick={() => props.onChange(option.value)}
            role="tab"
            type="button"
          >
            {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

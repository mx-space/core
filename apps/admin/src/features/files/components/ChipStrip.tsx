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
      className="flex flex-wrap gap-2 border-b border-border px-4 py-3"
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
                ? 'border-accent bg-accent text-white hover:bg-accent-hover'
                : 'border-border text-fg-muted hover:bg-surface-inset',
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

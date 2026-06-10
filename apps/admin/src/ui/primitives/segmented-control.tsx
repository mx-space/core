import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useId } from 'react'

import { cn } from '~/utils/cn'

export interface SegmentedControlOption<TValue extends string = string> {
  label: ReactNode
  value: TValue
}

interface SegmentedControlProps<TValue extends string = string> {
  'aria-label'?: string
  className?: string
  fill?: boolean
  onValueChange: (value: TValue) => void
  options: SegmentedControlOption<TValue>[]
  value: TValue
}

export function SegmentedControl<TValue extends string = string>(
  props: SegmentedControlProps<TValue>,
) {
  const indicatorId = `segmented-indicator-${useId()}`
  const reducedMotion = useReducedMotion()

  return (
    <div
      aria-label={props['aria-label']}
      className={cn(
        'inline-flex items-center gap-1 overflow-x-auto rounded-sm bg-surface-inset p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        props.fill && 'flex w-full',
        props.className,
      )}
      role="tablist"
    >
      {props.options.map((option) => {
        const active = props.value === option.value
        return (
          <button
            aria-selected={active}
            className={cn(
              'relative whitespace-nowrap rounded-xs px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
              props.fill && 'flex-1',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
            key={option.value}
            onClick={() => props.onValueChange(option.value)}
            role="tab"
            type="button"
          >
            {active ? (
              <motion.span
                aria-hidden="true"
                className="shadow-xs absolute inset-0 rounded-xs bg-surface-card ring-1 ring-black/[0.04] dark:ring-white/10"
                layoutId={indicatorId}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

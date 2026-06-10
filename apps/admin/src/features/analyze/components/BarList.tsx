import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

import { formatNumber } from '../utils/analyze'

export interface BarListItem {
  key: string
  label: ReactNode
  title?: string
  value: number
}

export function BarList(props: { className?: string; items: BarListItem[] }) {
  const max = Math.max(...props.items.map((item) => item.value), 1)

  return (
    <div className={cn('space-y-1', props.className)}>
      {props.items.map((item) => (
        <div
          className="relative h-8 overflow-hidden rounded-sm"
          key={item.key}
          title={item.title}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-sm bg-accent-soft"
            style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
          />
          <div className="relative flex h-full min-w-0 items-center justify-between gap-3 px-2.5">
            <span className="min-w-0 truncate text-sm text-fg">
              {item.label}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-fg-muted">
              {formatNumber(item.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

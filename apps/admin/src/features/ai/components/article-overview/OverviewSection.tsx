import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export function OverviewSection(props: {
  title: string
  action?: ReactNode
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-border bg-surface-inset px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {props.title}
        </span>
        {props.action}
      </div>
      <div className={cn('p-3', props.bodyClassName)}>{props.children}</div>
    </section>
  )
}

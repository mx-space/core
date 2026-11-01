import type { ReactNode } from 'react'

import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { cn } from '~/utils/cn'

export interface PageHeaderBarProps {
  actions?: ReactNode
  className?: string
  count?: ReactNode
  filters?: ReactNode
  summary?: ReactNode
  title: ReactNode
}

export function PageHeaderBar(props: PageHeaderBarProps) {
  return (
    <header
      className={cn(
        'shrink-0 border-b border-border bg-background px-4',
        props.className,
      )}
      data-page-header=""
    >
      <div className="flex min-h-12 flex-wrap items-center gap-x-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MobileHeaderAffordance />
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-fg">
            <span className="truncate">{props.title}</span>
            {props.count == null ? null : (
              <span className="text-xs font-normal tabular-nums text-fg-subtle">
                {props.count}
              </span>
            )}
          </h1>
        </div>
        {props.filters ? (
          <div className="order-last flex w-full items-center gap-1 overflow-x-auto pb-2 md:order-none md:w-auto md:pb-0">
            {props.filters}
          </div>
        ) : null}
        {props.actions ? (
          <div className="flex shrink-0 items-center gap-1">
            {props.actions}
          </div>
        ) : null}
      </div>
      {props.summary ? (
        <div className="-mt-1 truncate pb-2.5 text-xs text-fg-muted">
          {props.summary}
        </div>
      ) : null}
    </header>
  )
}

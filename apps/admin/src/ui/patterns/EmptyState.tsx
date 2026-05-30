import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  action,
  className,
  description,
  icon: Icon,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl bg-surface-inset p-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="shadow-xs flex size-11 items-center justify-center rounded-lg bg-surface-card">
          <Icon aria-hidden="true" className="size-5 text-fg-muted" />
        </span>
      ) : null}
      <div className="space-y-1">
        <div className="text-base font-semibold text-fg">{title}</div>
        {description ? (
          <div className="text-sm text-fg-muted">{description}</div>
        ) : null}
      </div>
      {action ?? null}
    </div>
  )
}

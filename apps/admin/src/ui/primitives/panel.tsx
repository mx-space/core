import type { PropsWithChildren, ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface PanelProps extends PropsWithChildren {
  className?: string
  description?: ReactNode
  title: ReactNode
}

export function Panel(props: PanelProps) {
  return (
    <section className={cn('bg-background', props.className)}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-fg">{props.title}</h2>
        {props.description ? (
          <p className="mt-1 text-xs text-fg-muted">{props.description}</p>
        ) : null}
      </div>
      {props.children}
    </section>
  )
}

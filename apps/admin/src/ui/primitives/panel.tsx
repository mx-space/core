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
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-sm font-medium">{props.title}</h2>
        {props.description ? (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {props.description}
          </p>
        ) : null}
      </div>
      {props.children}
    </section>
  )
}

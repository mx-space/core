import { Hash } from 'lucide-react'
import type { ReactNode } from 'react'

export function EntitySummary(props: {
  countLabel: string
  icon: ReactNode
  meta?: string
  title: string
}) {
  return (
    <section className="mb-6 flex items-start gap-4 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-white text-neutral-500 dark:bg-neutral-950 dark:text-neutral-300">
        {props.icon}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          {props.title}
        </h3>
        {props.meta ? (
          <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            <Hash aria-hidden="true" className="size-3" />
            {props.meta}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {props.countLabel}
        </p>
      </div>
    </section>
  )
}

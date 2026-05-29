import type { ReactNode } from 'react'

import { ListSkeleton } from './ListSkeleton'

export function ListSection(props: {
  children: ReactNode
  count: number
  loading: boolean
  title: string
}) {
  return (
    <section>
      <div className="flex h-9 items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 dark:border-neutral-800/70 dark:bg-neutral-900/60">
        <h3 className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
          {props.title}
        </h3>
        <span className="text-xs tabular-nums text-neutral-400">
          {props.count}
        </span>
      </div>
      {props.loading ? <ListSkeleton /> : props.children}
    </section>
  )
}

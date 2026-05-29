import type { AITaskStatus as AITaskStatusType } from '~/api/ai'
import type { ReactNode } from 'react'

import { AITaskStatus } from '~/api/ai'
import { Badge } from '~/ui/primitives/badge'
import type { BadgeTone } from '~/ui/primitives/badge'
import { Scroll } from '~/ui/primitives/scroll'

const statusToneMap: Record<AITaskStatusType, BadgeTone> = {
  [AITaskStatus.Pending]: 'neutral',
  [AITaskStatus.Running]: 'info',
  [AITaskStatus.Completed]: 'success',
  [AITaskStatus.PartialFailed]: 'warning',
  [AITaskStatus.Failed]: 'danger',
  [AITaskStatus.Cancelled]: 'neutral',
}

export function StatusBadge(props: {
  children: ReactNode
  status: AITaskStatusType
}) {
  return <Badge tone={statusToneMap[props.status]}>{props.children}</Badge>
}

export { Badge as SmallBadge } from '~/ui/primitives/badge'

export function Field(props: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {props.label}
      </div>
      <div className="min-w-0 text-neutral-950 dark:text-neutral-50">
        {props.children}
      </div>
    </div>
  )
}

export function Code(props: { children: ReactNode }) {
  return (
    <code className="block truncate rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      {props.children}
    </code>
  )
}

export function DetailBlock(props: { children: ReactNode; title: string }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
        {props.title}
      </h3>
      {props.children}
    </section>
  )
}

export function JsonBlock(props: { value: unknown }) {
  return (
    <Scroll
      className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
      orientation="both"
      viewportClassName="max-h-72"
    >
      <pre className="p-3 text-xs leading-5 text-neutral-800 dark:text-neutral-200">
        {JSON.stringify(props.value, null, 2)}
      </pre>
    </Scroll>
  )
}

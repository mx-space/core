import type { Globe } from 'lucide-react'

import { Scroll } from '~/ui/primitives/scroll'

import { formatJson, getEventColorClass } from '../utils/webhooks'

export function StatusDot(props: { enabled: boolean }) {
  return (
    <span
      className={[
        'inline-flex size-2 shrink-0 rounded-full',
        props.enabled ? 'bg-green-500' : 'bg-neutral-400',
      ].join(' ')}
    />
  )
}

export function EventBadge(props: { event: string }) {
  const colorClass = getEventColorClass(props.event)

  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${colorClass}`}>
      {props.event}
    </span>
  )
}

export function InfoCard(props: {
  icon: typeof Globe
  label: string
  value: string
}) {
  const Icon = props.icon

  return (
    <div className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-2 flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
        <Icon aria-hidden="true" className="size-4" />
        <span className="text-xs">{props.label}</span>
      </div>
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {props.value}
      </div>
    </div>
  )
}

export function JsonBlock(props: { content: unknown; label: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-neutral-500">
        {props.label}
      </div>
      <Scroll
        className="rounded bg-neutral-100 dark:bg-neutral-800"
        orientation="both"
        viewportClassName="max-h-56"
      >
        <pre className="p-2 text-xs text-neutral-700 dark:text-neutral-300">
          {formatJson(props.content) || '-'}
        </pre>
      </Scroll>
    </div>
  )
}

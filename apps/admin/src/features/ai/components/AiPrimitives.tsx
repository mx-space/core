import type { AITaskStatus } from '~/api/ai'
import type { ReactNode } from 'react'

import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { statusClassName } from '../constants'

export function StatusBadge(props: {
  children: ReactNode
  status: AITaskStatus
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded border px-2 py-1 text-xs font-medium',
        statusClassName[props.status],
      )}
    >
      {props.children}
    </span>
  )
}

export function SmallBadge(props: {
  children: ReactNode
  tone?: 'danger' | 'default' | 'info' | 'success' | 'warning'
}) {
  const tone = props.tone ?? 'default'
  const className = {
    danger:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300',
    default:
      'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
    info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    warning:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  }[tone]

  return (
    <span className={cn('inline-flex rounded border px-2 py-1', className)}>
      {props.children}
    </span>
  )
}

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

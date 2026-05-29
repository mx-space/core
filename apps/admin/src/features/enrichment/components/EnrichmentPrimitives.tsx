import { DatabaseZap, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '~/ui/primitives/badge'
import { Scroll } from '~/ui/primitives/scroll'

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

export function ProviderBadge(props: { provider: string }) {
  return <Badge tone="info">{props.provider}</Badge>
}

export { Badge as SmallBadge } from '~/ui/primitives/badge'

export function ListLoading() {
  return (
    <div className="flex min-h-[24rem] items-center justify-center">
      <Loader2
        aria-hidden="true"
        className="size-5 animate-spin text-neutral-400"
      />
    </div>
  )
}

export function ListEmpty(props: { label: string }) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <DatabaseZap aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {props.label}
      </p>
    </div>
  )
}

export function DetailEmpty(props: { label: string }) {
  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <DatabaseZap aria-hidden="true" className="size-8 text-neutral-300" />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {props.label}
      </p>
    </div>
  )
}

export function DetailLoading(props: { label: string }) {
  return (
    <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-4 text-center">
      <Loader2
        aria-hidden="true"
        className="size-5 animate-spin text-neutral-400"
      />
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {props.label}
      </p>
    </div>
  )
}

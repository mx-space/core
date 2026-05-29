import { Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Scroll } from '~/ui/primitives/scroll'

export function Field(props: { children: ReactNode; label: string }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {props.label}
      </span>
      {props.children}
    </div>
  )
}

export function Modal(props: {
  children: ReactNode
  onClose: () => void
  open: boolean
  title: string
}) {
  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            onClick={props.onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <Scroll className="flex-1" innerClassName="p-5">
          {props.children}
        </Scroll>
      </div>
    </div>
  )
}

export function SidePanel(props: {
  children: ReactNode
  onClose: () => void
  open: boolean
  title: string
}) {
  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/40"
        onClick={props.onClose}
        type="button"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            onClick={props.onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-5">{props.children}</div>
      </aside>
    </div>
  )
}

export function InlineLoading(props: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      {props.label}
    </span>
  )
}

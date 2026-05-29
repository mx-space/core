import type { ReactNode } from 'react'

export function EmptyList(props: { action?: ReactNode; label: string }) {
  return (
    <div className="border-b border-neutral-100 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800/60 dark:text-neutral-400">
      <p>{props.label}</p>
      {props.action}
    </div>
  )
}

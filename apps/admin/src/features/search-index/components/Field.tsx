import type { ReactNode } from 'react'

export function Field(props: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {props.label}
      </div>
      <div className="text-neutral-950 dark:text-neutral-50">
        {props.children}
      </div>
    </div>
  )
}

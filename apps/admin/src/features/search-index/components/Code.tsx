import type { ReactNode } from 'react'

export function Code(props: { children: ReactNode; title?: string }) {
  return (
    <code
      className="block truncate rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      title={props.title}
    >
      {props.children}
    </code>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router'

export function DeskCard(props: { children: ReactNode; title: ReactNode }) {
  return (
    <section className="shadow-sm overflow-hidden rounded-lg border border-border bg-surface-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-medium text-fg">
        {props.title}
      </h2>
      <ul>{props.children}</ul>
    </section>
  )
}

const deskRowClassName =
  'focus-visible:outline-hidden flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15'

export function DeskRow(props: {
  children: ReactNode
  onClick?: () => void
  to?: string
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      {props.to ? (
        <Link className={deskRowClassName} to={props.to}>
          {props.children}
        </Link>
      ) : (
        <button
          className={deskRowClassName}
          onClick={props.onClick}
          type="button"
        >
          {props.children}
        </button>
      )}
    </li>
  )
}

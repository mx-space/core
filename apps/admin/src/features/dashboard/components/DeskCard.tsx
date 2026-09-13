import type { ReactNode } from 'react'
import { Link } from 'react-router'

export const deskSectionClassName =
  'shadow-sm overflow-hidden rounded-lg border border-border bg-surface-card phone:rounded-none phone:border-x-0 phone:border-t-0 phone:bg-transparent phone:shadow-none'

export const deskHeaderClassName =
  'flex items-baseline justify-between gap-3 border-b border-border px-3.5 py-2 text-sm font-medium text-fg phone:border-border-strong phone:px-0'

export function DeskCard(props: {
  aside?: ReactNode
  children: ReactNode
  title: ReactNode
}) {
  return (
    <section className={deskSectionClassName}>
      <h2 className={deskHeaderClassName}>
        {props.title}
        {props.aside ? (
          <span className="truncate text-xs font-normal tabular-nums text-fg-subtle">
            {props.aside}
          </span>
        ) : null}
      </h2>
      <ul>{props.children}</ul>
    </section>
  )
}

const deskRowClassName =
  'focus-visible:outline-hidden flex w-full items-center gap-3 px-3.5 py-1.5 text-left phone:px-0 transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15'

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

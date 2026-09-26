import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '~/utils/cn'

export const deskFocusClassName =
  'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15'

export function DeskSectionTitle(props: {
  aside?: ReactNode
  title: ReactNode
}) {
  return (
    <h2 className="mb-3 flex items-baseline justify-between gap-3 text-xs font-normal text-fg-subtle">
      <span className="min-w-0 truncate">{props.title}</span>
      {props.aside ? (
        <span className="shrink-0 tabular-nums">{props.aside}</span>
      ) : null}
    </h2>
  )
}

export function DeskSection(props: {
  aside?: ReactNode
  children: ReactNode
  className?: string
  title: ReactNode
}) {
  return (
    <section
      className={cn('border-t border-border py-7 phone:py-6', props.className)}
    >
      <DeskSectionTitle aside={props.aside} title={props.title} />
      {props.children}
    </section>
  )
}

export function DeskRailSection(props: {
  aside?: ReactNode
  children: ReactNode
  className?: string
  title: ReactNode
}) {
  return (
    <section
      className={cn(
        'min-w-0 py-6 phone:border-t phone:border-border',
        props.className,
      )}
    >
      <DeskSectionTitle aside={props.aside} title={props.title} />
      {props.children}
    </section>
  )
}

export function DeskItem(props: {
  children: ReactNode
  className?: string
  onClick?: () => void
  to?: string
}) {
  const className = cn('group block w-full text-left', props.className)
  if (props.to) {
    return (
      <Link className={cn(className, deskFocusClassName)} to={props.to}>
        {props.children}
      </Link>
    )
  }
  if (props.onClick) {
    return (
      <button
        className={cn(className, deskFocusClassName)}
        onClick={props.onClick}
        type="button"
      >
        {props.children}
      </button>
    )
  }
  return <div className={className}>{props.children}</div>
}

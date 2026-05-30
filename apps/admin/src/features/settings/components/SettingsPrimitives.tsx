import type { ReactNode } from 'react'

import { Badge } from '~/ui/primitives/badge'
import { cn } from '~/utils/cn'

export function FieldShell(props: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">
        {props.label}
      </span>
      {props.children}
    </label>
  )
}

export function EmptyState(props: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center px-4 text-center">
      <div className="text-neutral-300">{props.icon}</div>
      <p className="mt-3 text-sm text-neutral-500">{props.label}</p>
    </div>
  )
}

export function SettingsSkeleton(props: { title: string }) {
  return (
    <SettingsSection title={props.title}>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-9 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
            key={index}
          />
        ))}
      </div>
    </SettingsSection>
  )
}

export function SmallBadge(props: { children: ReactNode }) {
  return (
    <Badge size="sm" variant="soft">
      {props.children}
    </Badge>
  )
}

export function SettingsSection(props: {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  description?: ReactNode
  dirty?: boolean
  title: ReactNode
}) {
  return (
    <section className={cn('space-y-4', props.className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {props.title}
            {props.dirty ? (
              <span
                aria-label="unsaved"
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
              />
            ) : null}
          </h2>
          {props.description ? (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {props.description}
            </p>
          ) : null}
        </div>
        {props.actions ? (
          <div className="flex shrink-0 items-center gap-2">
            {props.actions}
          </div>
        ) : null}
      </header>
      {props.children}
    </section>
  )
}

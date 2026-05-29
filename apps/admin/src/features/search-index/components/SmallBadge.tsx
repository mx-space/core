import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export function SmallBadge(props: {
  children: ReactNode
  tone?: 'default' | 'success' | 'warning'
}) {
  const tone = props.tone ?? 'default'
  const className = {
    default:
      'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    warning:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  }[tone]

  return (
    <span
      className={cn('inline-flex rounded border px-2 py-1 text-xs', className)}
    >
      {props.children}
    </span>
  )
}

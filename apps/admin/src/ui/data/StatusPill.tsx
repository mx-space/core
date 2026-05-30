import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

type Tone = 'live' | 'draft' | 'error' | 'scheduled' | 'archived' | 'pending'

const toneClasses: Record<Tone, string> = {
  live: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  draft:
    'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  error: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  scheduled: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  archived:
    'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  pending:
    'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
}

export interface StatusPillProps {
  tone: Tone
  children: ReactNode
  className?: string
}

export function StatusPill({ children, className, tone }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

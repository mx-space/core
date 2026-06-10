import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export type BadgeTone =
  | 'accent'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'success'
  | 'warning'

export type BadgeSize = 'md' | 'sm'

export type BadgeVariant = 'bordered' | 'outline' | 'soft'

export interface BadgeProps {
  children: ReactNode
  className?: string
  pill?: boolean
  size?: BadgeSize
  title?: string
  tone?: BadgeTone
  variant?: BadgeVariant
  'data-testid'?: string
}

const sizeClass: Record<BadgeSize, string> = {
  md: 'px-2 py-1 text-xs',
  sm: 'px-1.5 py-0.5 text-xs',
}

const borderedToneClass: Record<BadgeTone, string> = {
  accent: 'border-accent/40 bg-accent-soft text-accent',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
  neutral:
    'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
}

const softToneClass: Record<BadgeTone, string> = {
  accent: 'bg-accent-soft text-accent',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  neutral:
    'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
}

const outlineToneClass: Record<BadgeTone, string> = {
  accent: 'border-accent text-accent',
  danger: 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300',
  info: 'border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300',
  neutral:
    'border-neutral-200 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300',
  success:
    'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300',
  warning:
    'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300',
}

function toneClassFor(variant: BadgeVariant, tone: BadgeTone) {
  if (variant === 'soft') return softToneClass[tone]
  if (variant === 'outline') return outlineToneClass[tone]
  return borderedToneClass[tone]
}

export function Badge(props: BadgeProps) {
  const tone = props.tone ?? 'neutral'
  const size = props.size ?? 'md'
  const variant = props.variant ?? 'bordered'
  const hasBorder = variant !== 'soft'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 font-medium leading-none',
        hasBorder && 'border',
        props.pill ? 'rounded-full' : 'rounded-xs',
        sizeClass[size],
        toneClassFor(variant, tone),
        props.className,
      )}
      data-testid={props['data-testid']}
      title={props.title}
    >
      {props.children}
    </span>
  )
}

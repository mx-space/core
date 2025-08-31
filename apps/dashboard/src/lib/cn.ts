// Tremor Raw cx [v0.0.0]

import type { ClassValue } from 'clsx'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

export const clsxm = (...args: any[]) => {
  return twMerge(clsx(args))
}

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

// Tremor focusInput [v0.0.2]

export const focusInput = [
  // base
  'focus:ring-2',
  // ring color
  'focus:ring-primary/20',
  // border color
  'focus:border-primary',
]

// Tremor Raw focusRing [v0.0.1]

export const focusRing = [
  // base
  'outline-offset-2 outline-0 focus-visible:outline-2',
  // outline color
  'outline-primary',
]

// Tremor Raw hasErrorInput [v0.0.1]

export const hasErrorInput = [
  // base
  'ring-2',
  // border color
  'border-red',
  // ring color
  'ring-red/20',
]

export { default as cn } from 'clsx'

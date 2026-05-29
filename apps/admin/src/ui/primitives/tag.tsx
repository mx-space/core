import type { ReactNode } from 'react'

import { cn } from '~/utils/cn'

export interface TagProps {
  children: ReactNode
  className?: string
  title?: string
}

export function Tag(props: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs leading-none text-neutral-500 dark:text-neutral-400',
        props.className,
      )}
      title={props.title}
    >
      {props.children}
    </span>
  )
}

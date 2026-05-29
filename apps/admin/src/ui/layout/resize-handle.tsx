import { Separator } from 'react-resizable-panels'
import type { SeparatorProps } from 'react-resizable-panels'

import { cn } from '~/utils/cn'

export function ResizeHandle({ className, disabled, ...rest }: SeparatorProps) {
  return (
    <Separator
      {...rest}
      className={cn(
        'outline-hidden relative w-px shrink-0 cursor-col-resize bg-neutral-200 dark:bg-neutral-800',
        // 16px 透明 hit zone，覆于 Panel 之上
        'before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:z-10 before:content-[""]',
        // 居中 pill，hover/focus/active 时显
        'after:pointer-events-none after:absolute after:left-1/2 after:top-1/2 after:z-10 after:h-8 after:w-1 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-neutral-400 after:opacity-0 after:transition-opacity after:content-[""] dark:after:bg-neutral-500',
        'hover:after:opacity-100',
        'focus-visible:after:opacity-100',
        'data-[separator=active]:after:opacity-100',
        disabled && 'pointer-events-none bg-transparent hover:after:opacity-0',
        className,
      )}
      disabled={disabled}
    />
  )
}

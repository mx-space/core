import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '~/utils/cn'

interface ScrollProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  innerClassName?: string
  orientation?: 'both' | 'horizontal' | 'vertical'
  viewportClassName?: string
}

export const Scroll = forwardRef<HTMLDivElement, ScrollProps>(
  function Scroll(props, ref) {
    const {
      children,
      className,
      innerClassName,
      orientation = 'vertical',
      viewportClassName,
      ...rest
    } = props

    return (
      <div className={cn('min-h-0 min-w-0', className)} {...rest}>
        <div
          className={cn(
            'h-full min-h-0 min-w-0',
            orientation === 'vertical'
              ? 'overflow-y-auto overflow-x-hidden'
              : orientation === 'horizontal'
                ? 'overflow-x-auto overflow-y-hidden'
                : 'overflow-auto',
            viewportClassName,
          )}
          ref={ref}
        >
          <div className={cn('min-h-full min-w-0', innerClassName)}>
            {children}
          </div>
        </div>
      </div>
    )
  },
)

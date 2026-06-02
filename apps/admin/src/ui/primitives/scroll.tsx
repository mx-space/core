import { ScrollArea } from '@base-ui/react/scroll-area'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { forwardRef } from 'react'

import { cn } from '~/utils/cn'

interface ScrollProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  innerClassName?: string
  orientation?: 'both' | 'horizontal' | 'vertical'
  viewportClassName?: string
}

const SCROLLBAR_BASE =
  'flex touch-none select-none p-0.5 opacity-0 transition-opacity duration-150 data-[hovering]:opacity-100 data-[scrolling]:opacity-100'

const THUMB_BASE =
  'flex-1 rounded-full bg-neutral-500/40 hover:bg-neutral-500/60 dark:bg-neutral-400/30 dark:hover:bg-neutral-400/50'

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

    const showVertical = orientation === 'vertical' || orientation === 'both'
    const showHorizontal =
      orientation === 'horizontal' || orientation === 'both'

    return (
      <ScrollArea.Root className={cn('min-h-0 min-w-0', className)} {...rest}>
        <ScrollArea.Viewport
          className={cn(
            'h-full min-h-0 min-w-0 overscroll-contain',
            viewportClassName,
          )}
          ref={ref}
        >
          <div className={cn('min-h-full min-w-0', innerClassName)}>
            {children}
          </div>
        </ScrollArea.Viewport>
        {showVertical && (
          <ScrollArea.Scrollbar
            className={cn(SCROLLBAR_BASE, 'w-2.5')}
            orientation="vertical"
          >
            <ScrollArea.Thumb className={THUMB_BASE} />
          </ScrollArea.Scrollbar>
        )}
        {showHorizontal && (
          <ScrollArea.Scrollbar
            className={cn(SCROLLBAR_BASE, 'h-2.5 flex-col')}
            orientation="horizontal"
          >
            <ScrollArea.Thumb className={THUMB_BASE} />
          </ScrollArea.Scrollbar>
        )}
        {orientation === 'both' && <ScrollArea.Corner />}
      </ScrollArea.Root>
    )
  },
)

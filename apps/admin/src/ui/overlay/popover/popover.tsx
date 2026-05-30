import { Popover as BasePopover } from '@base-ui/react/popover'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'

import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

type RootProps = ComponentPropsWithoutRef<typeof BasePopover.Root>

function PopoverRoot({ children, ...rest }: RootProps) {
  return <BasePopover.Root {...rest}>{children}</BasePopover.Root>
}

type TriggerProps = Omit<
  ComponentPropsWithoutRef<typeof BasePopover.Trigger>,
  'className'
> & { className?: string }

function PopoverTrigger({ className, ...rest }: TriggerProps) {
  return (
    <BasePopover.Trigger
      {...rest}
      className={cn('outline-hidden', className)}
    />
  )
}

type PositionerProps = ComponentPropsWithoutRef<typeof BasePopover.Positioner>

type ContentProps = Omit<
  ComponentPropsWithoutRef<typeof BasePopover.Popup>,
  'className'
> & {
  align?: PositionerProps['align']
  alignOffset?: PositionerProps['alignOffset']
  className?: string
  container?: HTMLElement | null
  side?: PositionerProps['side']
  sideOffset?: PositionerProps['sideOffset']
  width?: 'auto' | 'sm' | 'md' | 'lg' | 'xl'
}

const widthClass: Record<NonNullable<ContentProps['width']>, string> = {
  auto: '',
  lg: 'w-[min(92vw,22rem)]',
  md: 'w-80',
  sm: 'w-64',
  xl: 'w-[min(92vw,32rem)]',
}

function PopoverContent({
  align = 'start',
  alignOffset,
  children,
  className,
  container,
  side = 'bottom',
  sideOffset = 6,
  width = 'auto',
  ...rest
}: ContentProps) {
  const { depth, z } = useFloatingZ('popover')
  const positionerStyle: CSSProperties = { zIndex: z }

  return (
    <BasePopover.Portal container={container ?? undefined}>
      <BasePopover.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        style={positionerStyle}
      >
        <PortalLayerScope depth={depth}>
          <BasePopover.Popup
            {...rest}
            className={cn(
              'outline-hidden shadow-md rounded-lg border border-border bg-surface-overlay text-sm text-fg',
              widthClass[width],
              className,
            )}
          >
            {children}
          </BasePopover.Popup>
        </PortalLayerScope>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

interface SectionProps {
  children: ReactNode
  className?: string
}

function PopoverHeader({ children, className }: SectionProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-subtle',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PopoverBody({ children, className }: SectionProps) {
  return <div className={cn('p-3', className)}>{children}</div>
}

function PopoverFooter({ children, className }: SectionProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-fg-muted',
        className,
      )}
    >
      {children}
    </div>
  )
}

export const Popover = Object.assign(PopoverRoot, {
  Body: PopoverBody,
  Content: PopoverContent,
  Footer: PopoverFooter,
  Header: PopoverHeader,
  Trigger: PopoverTrigger,
})

export type {
  ContentProps as PopoverContentProps,
  TriggerProps as PopoverTriggerProps,
}

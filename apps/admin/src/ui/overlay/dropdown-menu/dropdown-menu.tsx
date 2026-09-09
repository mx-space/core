import { Menu } from '@base-ui/react/menu'
import type { ComponentPropsWithoutRef, ReactNode, RefObject } from 'react'
import { createContext, useCallback, useContext, useRef } from 'react'

import { menuStyles } from '~/ui/overlay/menu-styles'
import { cn } from '~/utils/cn'

import {
  useCloseOnAnchorHidden,
  useFloatLayerContainer,
  useLayerZIndex,
} from '../floating-layer'

type RootProps = ComponentPropsWithoutRef<typeof Menu.Root>

const MenuActionsContext =
  createContext<RefObject<Menu.Root.Actions | null> | null>(null)

function DropdownMenuRoot({ actionsRef, children, ...rest }: RootProps) {
  const fallbackRef = useRef<Menu.Root.Actions | null>(null)
  const resolvedRef = actionsRef ?? fallbackRef

  return (
    <MenuActionsContext value={resolvedRef}>
      <Menu.Root {...rest} actionsRef={resolvedRef}>
        {children}
      </Menu.Root>
    </MenuActionsContext>
  )
}

type TriggerOwnProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.Trigger>,
  'className'
> & { className?: string }

function DropdownMenuTrigger({ className, ...rest }: TriggerOwnProps) {
  return <Menu.Trigger {...rest} className={cn('outline-hidden', className)} />
}

type PositionerProps = ComponentPropsWithoutRef<typeof Menu.Positioner>

type ContentProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.Popup>,
  'className'
> & {
  align?: PositionerProps['align']
  alignOffset?: PositionerProps['alignOffset']
  className?: string
  container?: HTMLElement | null
  side?: PositionerProps['side']
  sideOffset?: PositionerProps['sideOffset']
}

function DropdownMenuContent({
  align = 'start',
  alignOffset,
  children,
  className,
  container,
  side = 'bottom',
  sideOffset = 6,
  ...rest
}: ContentProps) {
  const { ref: zRef, zIndex } = useLayerZIndex<HTMLDivElement>('floating')
  const actionsRef = useContext(MenuActionsContext)
  const anchorRef = useCloseOnAnchorHidden<HTMLDivElement>(() => {
    actionsRef?.current?.close()
  })
  const positionerRef = useCallback(
    (node: HTMLDivElement | null) => {
      zRef(node)
      anchorRef(node)
    },
    [anchorRef, zRef],
  )
  const ctxContainer = useFloatLayerContainer()
  const resolvedContainer = container ?? ctxContainer ?? undefined

  return (
    <Menu.Portal container={resolvedContainer}>
      <Menu.Positioner
        align={align}
        alignOffset={alignOffset}
        ref={positionerRef}
        side={side}
        sideOffset={sideOffset}
        style={{ zIndex }}
      >
        <Menu.Popup {...rest} className={cn(menuStyles.popup, className)}>
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

type ItemProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.Item>,
  'className'
> & {
  className?: string
  danger?: boolean
}

function DropdownMenuItem({ className, danger, ...rest }: ItemProps) {
  return (
    <Menu.Item
      {...rest}
      className={cn(menuStyles.item, danger && menuStyles.danger, className)}
      data-danger={danger ? '' : undefined}
    />
  )
}

type SeparatorProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.Separator>,
  'className'
> & { className?: string }

function DropdownMenuSeparator({ className, ...rest }: SeparatorProps) {
  return (
    <Menu.Separator {...rest} className={cn(menuStyles.separator, className)} />
  )
}

const DropdownMenuGroup = Menu.Group

type GroupLabelProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.GroupLabel>,
  'className'
> & { className?: string }

function DropdownMenuGroupLabel({ className, ...rest }: GroupLabelProps) {
  return (
    <Menu.GroupLabel
      {...rest}
      className={cn(menuStyles.groupLabel, className)}
    />
  )
}

interface DropdownMenuEmptyProps {
  children: ReactNode
}

function DropdownMenuEmpty({ children }: DropdownMenuEmptyProps) {
  return (
    <div className="px-2 py-3 text-center text-xs text-fg-subtle">
      {children}
    </div>
  )
}

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Content: DropdownMenuContent,
  Empty: DropdownMenuEmpty,
  Group: DropdownMenuGroup,
  GroupLabel: DropdownMenuGroupLabel,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Trigger: DropdownMenuTrigger,
})

export type {
  ContentProps as DropdownMenuContentProps,
  ItemProps as DropdownMenuItemProps,
}

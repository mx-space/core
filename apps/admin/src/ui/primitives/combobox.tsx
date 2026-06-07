import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { Check, ChevronDown } from 'lucide-react'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'

import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { menuStyles } from '~/ui/overlay/menu-styles'
import { cn } from '~/utils/cn'

import { inputBaseClassName } from './input-styles'

type RootProps = ComponentPropsWithoutRef<typeof BaseCombobox.Root>

function ComboboxRoot(props: RootProps) {
  return <BaseCombobox.Root {...props} />
}

type InputProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Input>,
  'className'
> & { className?: string }

function ComboboxInput({ className, ...rest }: InputProps) {
  return (
    <BaseCombobox.Input
      {...rest}
      className={cn(inputBaseClassName, 'pr-9', className)}
    />
  )
}

type TriggerProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Trigger>,
  'className'
> & { className?: string }

function ComboboxTrigger({ children, className, ...rest }: TriggerProps) {
  return (
    <BaseCombobox.Trigger
      {...rest}
      className={cn(
        'outline-hidden absolute inset-y-0 right-0 flex w-8 items-center justify-center text-fg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
        className,
      )}
    >
      {children ?? <ChevronDown aria-hidden="true" className="size-4" />}
    </BaseCombobox.Trigger>
  )
}

interface ComboboxControlProps {
  children: ReactNode
  className?: string
}

function ComboboxControl({ children, className }: ComboboxControlProps) {
  return <div className={cn('relative', className)}>{children}</div>
}

type PositionerProps = ComponentPropsWithoutRef<typeof BaseCombobox.Positioner>

type ContentProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Popup>,
  'className'
> & {
  align?: PositionerProps['align']
  className?: string
  container?: HTMLElement | null
  side?: PositionerProps['side']
  sideOffset?: PositionerProps['sideOffset']
}

function ComboboxContent({
  align,
  children,
  className,
  container,
  side,
  sideOffset = 6,
  ...rest
}: ContentProps) {
  const { depth, z } = useFloatingZ('popover')
  const style: CSSProperties = { zIndex: z }

  return (
    <BaseCombobox.Portal container={container ?? undefined}>
      <BaseCombobox.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        style={style}
      >
        <PortalLayerScope depth={depth}>
          <BaseCombobox.Popup
            {...rest}
            className={cn(
              'outline-hidden shadow-md w-[var(--anchor-width)] overflow-hidden rounded-lg border border-border bg-surface-overlay text-sm text-fg',
              className,
            )}
          >
            {children}
          </BaseCombobox.Popup>
        </PortalLayerScope>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  )
}

const ComboboxList = BaseCombobox.List

type ItemProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Item>,
  'className'
> & { className?: string }

function ComboboxItem({ children, className, ...rest }: ItemProps) {
  return (
    <BaseCombobox.Item
      {...rest}
      className={cn(menuStyles.item, 'justify-between', className)}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <BaseCombobox.ItemIndicator>
        <Check aria-hidden="true" className="size-4 text-accent" />
      </BaseCombobox.ItemIndicator>
    </BaseCombobox.Item>
  )
}

const ComboboxGroup = BaseCombobox.Group

type GroupLabelProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.GroupLabel>,
  'className'
> & { className?: string }

function ComboboxGroupLabel({ className, ...rest }: GroupLabelProps) {
  return (
    <BaseCombobox.GroupLabel
      {...rest}
      className={cn(menuStyles.groupLabel, className)}
    />
  )
}

type EmptyProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Empty>,
  'className'
> & { className?: string }

function ComboboxEmpty({ children, className, ...rest }: EmptyProps) {
  return (
    <BaseCombobox.Empty {...rest} className={className}>
      {children == null ? null : (
        <div className="px-2 py-3 text-center text-xs text-fg-subtle">
          {children}
        </div>
      )}
    </BaseCombobox.Empty>
  )
}

export const Combobox = Object.assign(ComboboxRoot, {
  Content: ComboboxContent,
  Control: ComboboxControl,
  Empty: ComboboxEmpty,
  Group: ComboboxGroup,
  GroupLabel: ComboboxGroupLabel,
  Input: ComboboxInput,
  Item: ComboboxItem,
  List: ComboboxList,
  Trigger: ComboboxTrigger,
})

export type {
  ContentProps as ComboboxContentProps,
  InputProps as ComboboxInputProps,
  ItemProps as ComboboxItemProps,
}

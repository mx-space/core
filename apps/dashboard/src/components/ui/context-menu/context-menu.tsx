import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import * as React from 'react'

import { clsxm } from '~/lib/cn'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuSub = ContextMenuPrimitive.Sub
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup
const RootPortal = ContextMenuPrimitive.Portal

const ContextMenuSubTrigger = ({
  ref,
  className,
  inset,
  hasIcon,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean
  hasIcon?: boolean
} & {
  ref?: React.Ref<React.ElementRef<
    typeof ContextMenuPrimitive.SubTrigger
  > | null>
}) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={clsxm(
      'focus:bg-accent relative focus:text-white text-foreground data-[state=open]:bg-accent data-[state=open]:text-white flex select-none items-center rounded-[5px] px-2.5 py-1.5 outline-none',
      inset && 'pl-8',
      hasIcon && 'pl-8',
      'flex items-center justify-center gap-2',
      className,
      props.disabled && 'cursor-not-allowed opacity-30',
    )}
    {...props}
  >
    {children}
    <i className="i-mingcute-right-line -mr-1 ml-auto size-3.5" />
  </ContextMenuPrimitive.SubTrigger>
)
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent> & {
  ref?: React.Ref<React.ElementRef<
    typeof ContextMenuPrimitive.SubContent
  > | null>
}) => (
  <RootPortal>
    <ContextMenuPrimitive.SubContent
      ref={ref}
      className={clsxm(
        'bg-material-medium backdrop-blur-background text-text text-body',
        'min-w-32 overflow-hidden border-border',
        'rounded-[6px] border p-1',
        'shadow-context-menu',
        'z-[10061]',
        className,
      )}
      {...props}
    />
  </RootPortal>
)
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const ContextMenuContent = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof ContextMenuPrimitive.Content> | null>
}) => (
  <RootPortal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={clsxm(
        'bg-material-medium backdrop-blur-background text-text shadow-context-menu z-[10060] min-w-32 overflow-hidden rounded-[6px] border border-border p-1',
        'text-body',
        className,
      )}
      {...props}
    />
  </RootPortal>
)
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = ({
  ref,
  className,
  inset,
  hasIcon,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean
  hasIcon?: boolean
} & {
  ref?: React.Ref<React.ElementRef<typeof ContextMenuPrimitive.Item> | null>
}) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={clsxm(
      'cursor-menu focus:bg-accent focus:text-white text-sm text-foreground relative flex select-none items-center rounded-[5px] px-2.5 py-1 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'data-[highlighted]:bg-accent data-[highlighted]:text-white focus-within:outline-transparent',
      'h-[28px]',
      inset && 'pl-8',
      hasIcon ? 'px-8' : 'pr-8',

      className,
    )}
    {...props}
  />
)
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = ({
  ref,
  className,
  children,
  checked,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem> & {
  ref?: React.Ref<React.ElementRef<
    typeof ContextMenuPrimitive.CheckboxItem
  > | null>
} & {
  hasIcon?: boolean
}) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={clsxm(
      'cursor-checkbox focus:bg-accent focus:text-white text-sm text-foreground relative flex select-none items-center rounded-[5px] py-1.5 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'focus-within:outline-transparent',
      'h-[28px]',
      props.hasIcon ? 'px-8 pr-8' : 'px-8',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span
      className={clsxm(
        'absolute flex items-center justify-center',
        props.hasIcon ? 'right-2' : 'left-2',
      )}
    >
      <ContextMenuPrimitive.ItemIndicator asChild>
        <i className="i-mingcute-check-fill size-3" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
)
ContextMenuCheckboxItem.displayName =
  ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuLabel = ({
  ref,
  className,
  inset,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean
} & {
  ref?: React.Ref<React.ElementRef<typeof ContextMenuPrimitive.Label> | null>
}) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={clsxm(
      'text-text px-2 py-1.5 font-semibold',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
)
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = ({
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator> & {
  ref?: React.Ref<React.ElementRef<
    typeof ContextMenuPrimitive.Separator
  > | null>
}) => (
  <ContextMenuPrimitive.Separator
    className="mx-2 my-1 h-px backdrop-blur-background"
    asChild
    ref={ref}
    {...props}
  >
    <div className="bg-border mr-2 h-px" />
  </ContextMenuPrimitive.Separator>
)
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  RootPortal as ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
}

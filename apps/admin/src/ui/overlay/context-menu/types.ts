import type { LucideIcon } from 'lucide-react'
import type {
  Key,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'

export type ContextMenuIcon = LucideIcon | ReactNode

export interface MenuClickInfo {
  domEvent: ReactKeyboardEvent<HTMLElement> | ReactMouseEvent<HTMLElement>
  key: Key
  keyPath: Key[]
}

/** A regular clickable item. `type` may be omitted or set to `'item'`. */
export interface ContextMenuItemType {
  closeOnClick?: boolean
  danger?: boolean
  desc?: ReactNode
  disabled?: boolean
  extra?: ReactNode
  icon?: ContextMenuIcon
  key?: Key
  label?: ReactNode
  onClick?: (info: MenuClickInfo) => void
  title?: string
  type?: 'item'
}

/** A toggleable item rendered as a Base UI `CheckboxItem`. */
export interface ContextMenuCheckboxItemType {
  checked?: boolean
  closeOnClick?: boolean
  danger?: boolean
  defaultChecked?: boolean
  desc?: ReactNode
  disabled?: boolean
  extra?: ReactNode
  icon?: ContextMenuIcon
  key?: Key
  label?: ReactNode
  onCheckedChange?: (checked: boolean) => void
  title?: ReactNode
  type: 'checkbox'
}

/** A nested submenu. `type` may be omitted when `children` is present. */
export interface ContextMenuSubmenuType {
  children: ContextMenuItem[]
  danger?: boolean
  desc?: ReactNode
  disabled?: boolean
  extra?: ReactNode
  icon?: ContextMenuIcon
  key?: Key
  label?: ReactNode
  title?: ReactNode
  type?: 'submenu'
}

/** A semantic group with an optional label. */
export interface ContextMenuGroupType {
  children?: ContextMenuItem[]
  key?: Key
  label?: ReactNode
  type: 'group'
}

/** A separator line. */
export interface ContextMenuDividerType {
  dashed?: boolean
  key?: Key
  type: 'divider'
}

export type ContextMenuItem =
  | ContextMenuItemType
  | ContextMenuCheckboxItemType
  | ContextMenuSubmenuType
  | ContextMenuGroupType
  | ContextMenuDividerType
  | null

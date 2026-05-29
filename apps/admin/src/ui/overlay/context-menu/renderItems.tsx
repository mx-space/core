import { ContextMenu } from '@base-ui/react/context-menu'
import { Check, ChevronRight } from 'lucide-react'
import { isValidElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import type {
  Key,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react'
import type {
  ContextMenuCheckboxItemType,
  ContextMenuDividerType,
  ContextMenuGroupType,
  ContextMenuItem,
  ContextMenuItemType,
  ContextMenuSubmenuType,
  MenuClickInfo,
} from './types'

import { useI18n } from '~/i18n'
import {
  useFloatLayerContainer,
  useLayerZIndex,
} from '~/ui/overlay/floating-layer'
import { menuStyles } from '~/ui/overlay/menu-styles'
import { cn } from '~/utils/cn'

export interface RenderOptions {
  /** Reserve a fixed-width icon slot for every item to align rows. */
  reserveIconSpace?: boolean
  /** Place the checkbox indicator on the right edge instead of the left icon slot. */
  indicatorOnRight?: boolean
}

function getItemKey(item: { key?: Key }, fallback: string): Key {
  return item.key ?? fallback
}

function getItemLabel(item: {
  key?: Key
  label?: ReactNode
  title?: ReactNode
}): ReactNode {
  if (item.label !== undefined) return item.label
  if (item.title !== undefined) return item.title
  return item.key
}

function isLucideIcon(value: unknown): value is LucideIcon {
  return typeof value === 'function' || typeof value === 'object'
}

function renderIcon(icon: ContextMenuItemType['icon']): ReactNode {
  if (!icon) return null
  if (isValidElement(icon)) return icon
  if (isLucideIcon(icon)) {
    const Component = icon as LucideIcon
    return <Component className="size-4" />
  }
  return null
}

function hasAnyIcon(items: ContextMenuItem[]): boolean {
  return items.some((item) => {
    if (!item) return false
    if ((item as ContextMenuCheckboxItemType).type === 'checkbox') return true
    if ('icon' in item && item.icon) return true
    return false
  })
}

function hasCheckboxAndIcon(items: ContextMenuItem[]): boolean {
  let hasCheckbox = false
  let hasIcon = false
  for (const item of items) {
    if (!item) continue
    if ((item as ContextMenuCheckboxItemType).type === 'checkbox') {
      hasCheckbox = true
    }
    if ('icon' in item && item.icon) {
      hasIcon = true
    }
    if (hasCheckbox && hasIcon) return true
  }
  return false
}

function invokeItemClick(
  item: ContextMenuItemType,
  keyPath: Key[],
  event: ReactKeyboardEvent<HTMLElement> | ReactMouseEvent<HTMLElement>,
): void {
  if (!item.onClick) return
  const key = item.key ?? keyPath.at(-1) ?? ''
  const info: MenuClickInfo = {
    domEvent: event,
    key,
    keyPath,
  }
  item.onClick(info)
}

interface ItemContentOptions {
  indicator?: ReactNode
  indicatorOnRight?: boolean
  reserveIconSpace?: boolean
  submenu?: boolean
}

function renderItemContent(
  item:
    | ContextMenuItemType
    | ContextMenuCheckboxItemType
    | ContextMenuSubmenuType,
  options: ItemContentOptions,
): ReactNode {
  const label = getItemLabel(item)
  const desc = 'desc' in item ? item.desc : undefined
  const extra = 'extra' in item ? item.extra : undefined
  const indicator = options.indicator
  const indicatorOnRight = options.indicatorOnRight ?? false

  const hasCustomIndicator = indicator !== undefined && !indicatorOnRight
  const itemIcon = 'icon' in item ? item.icon : undefined
  const hasIcon = hasCustomIndicator ? Boolean(indicator) : Boolean(itemIcon)
  const shouldRenderIconSlot = hasCustomIndicator
    ? Boolean(options.reserveIconSpace || indicator)
    : Boolean(hasIcon || options.reserveIconSpace)

  return (
    <>
      {shouldRenderIconSlot ? (
        <span aria-hidden={!hasIcon} className={menuStyles.iconSlot}>
          {hasCustomIndicator ? indicator : renderIcon(itemIcon)}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={menuStyles.label}>{label}</span>
        {desc ? <span className={menuStyles.desc}>{desc}</span> : null}
      </span>
      {extra ? <span className={menuStyles.extra}>{extra}</span> : null}
      {indicatorOnRight && indicator ? (
        <span className={menuStyles.indicatorRight}>{indicator}</span>
      ) : null}
      {options.submenu ? (
        <ChevronRight aria-hidden="true" className={menuStyles.submenuArrow} />
      ) : null}
    </>
  )
}

interface SubmenuRendererProps {
  item: ContextMenuSubmenuType
  keyPath: Key[]
  reserveIconSpace: boolean
}

function SubmenuRenderer({
  item,
  keyPath,
  reserveIconSpace,
}: SubmenuRendererProps) {
  const { t } = useI18n()
  const { ref: zRef, zIndex } = useLayerZIndex<HTMLDivElement>('floating')
  const container = useFloatLayerContainer()
  const submenuChildren = item.children ?? []
  const isDanger = Boolean(item.danger)

  return (
    <ContextMenu.SubmenuRoot>
      <ContextMenu.SubmenuTrigger
        className={cn(menuStyles.item, isDanger && menuStyles.danger)}
        data-danger={isDanger ? '' : undefined}
        disabled={item.disabled}
      >
        {renderItemContent(item, { reserveIconSpace, submenu: true })}
      </ContextMenu.SubmenuTrigger>
      <ContextMenu.Portal container={container ?? undefined}>
        <ContextMenu.Positioner
          alignOffset={-4}
          data-submenu=""
          ref={zRef}
          sideOffset={-1}
          style={{ zIndex }}
        >
          <ContextMenu.Popup className={menuStyles.popup}>
            {submenuChildren.length > 0 ? (
              renderContextMenuItems(submenuChildren, keyPath)
            ) : (
              <ContextMenu.Item
                className={cn(menuStyles.item, menuStyles.empty)}
                disabled
              >
                <span className={menuStyles.label}>
                  {t('ui.contextMenu.empty')}
                </span>
              </ContextMenu.Item>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.SubmenuRoot>
  )
}

export function renderContextMenuItems(
  items: ContextMenuItem[],
  keyPath: Key[] = [],
  options: RenderOptions = {},
): ReactNode[] {
  const reserveIconSpace = options.reserveIconSpace ?? hasAnyIcon(items)
  const indicatorOnRight = options.indicatorOnRight ?? hasCheckboxAndIcon(items)

  return items.map((item, index) => {
    if (!item) return null
    const fallbackKey = `${keyPath.join('-') || 'root'}-${index}`
    const itemKey = getItemKey(item, fallbackKey)
    const nextKeyPath = [...keyPath, itemKey]

    // Divider
    if ((item as ContextMenuDividerType).type === 'divider') {
      return (
        <ContextMenu.Separator
          className={menuStyles.separator}
          key={String(itemKey)}
        />
      )
    }

    // Group
    if ((item as ContextMenuGroupType).type === 'group') {
      const group = item as ContextMenuGroupType
      return (
        <ContextMenu.Group key={String(itemKey)}>
          {group.label ? (
            <ContextMenu.GroupLabel className={menuStyles.groupLabel}>
              {group.label}
            </ContextMenu.GroupLabel>
          ) : null}
          {group.children
            ? renderContextMenuItems(group.children, nextKeyPath, {
                indicatorOnRight: group.children
                  ? hasCheckboxAndIcon(group.children)
                  : false,
                reserveIconSpace,
              })
            : null}
        </ContextMenu.Group>
      )
    }

    // Checkbox
    if ((item as ContextMenuCheckboxItemType).type === 'checkbox') {
      const checkbox = item as ContextMenuCheckboxItemType
      const isDanger = Boolean(checkbox.danger)
      const indicator = (
        <ContextMenu.CheckboxItemIndicator>
          <Check aria-hidden="true" className="size-3.5" />
        </ContextMenu.CheckboxItemIndicator>
      )
      return (
        <ContextMenu.CheckboxItem
          checked={checkbox.checked}
          className={cn(menuStyles.item, isDanger && menuStyles.danger)}
          closeOnClick={checkbox.closeOnClick}
          data-danger={isDanger ? '' : undefined}
          defaultChecked={checkbox.defaultChecked}
          disabled={checkbox.disabled}
          key={String(itemKey)}
          onCheckedChange={(checked) => checkbox.onCheckedChange?.(checked)}
        >
          {renderItemContent(checkbox, {
            indicator,
            indicatorOnRight,
            reserveIconSpace,
          })}
        </ContextMenu.CheckboxItem>
      )
    }

    // Submenu (explicit type or implicit by having children)
    const maybeSubmenu = item as ContextMenuSubmenuType
    if (
      maybeSubmenu.type === 'submenu' ||
      ('children' in maybeSubmenu && Array.isArray(maybeSubmenu.children))
    ) {
      return (
        <SubmenuRenderer
          item={maybeSubmenu}
          key={String(itemKey)}
          keyPath={nextKeyPath}
          reserveIconSpace={reserveIconSpace}
        />
      )
    }

    // Regular item
    const regular = item as ContextMenuItemType
    const isDanger = Boolean(regular.danger)
    return (
      <ContextMenu.Item
        className={cn(menuStyles.item, isDanger && menuStyles.danger)}
        closeOnClick={regular.closeOnClick}
        data-danger={isDanger ? '' : undefined}
        disabled={regular.disabled}
        key={String(itemKey)}
        onClick={(event) => invokeItemClick(regular, nextKeyPath, event)}
      >
        {renderItemContent(regular, { reserveIconSpace })}
      </ContextMenu.Item>
    )
  })
}

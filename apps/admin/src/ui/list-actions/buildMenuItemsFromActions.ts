import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import type { ListAction } from './types'

/**
 * Wrap each `ListAction` as a context-menu item bound to a single target.
 *
 * - `available([target]) === false` items are dropped (cleaner than disabled).
 * - `shortcutLabel` is rendered as the menu's `extra` slot so the keyboard
 *   shortcut hint shows up alongside the label.
 *
 * For dynamic items (checkboxes, submenus) compose this output with extra
 * items in the per-feature menu builder.
 */
export function buildMenuItemsFromActions<T>(
  actions: ReadonlyArray<ListAction<T>>,
  target: T,
): ContextMenuItem[] {
  const out: ContextMenuItem[] = []
  for (const action of actions) {
    if (action.available && !action.available([target])) continue
    out.push({
      danger: action.danger,
      extra: action.shortcutLabel,
      icon: action.icon,
      key: action.key,
      label: action.label,
      onClick: () => void action.run([target]),
    })
  }
  return out
}

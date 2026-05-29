import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Single behavior shared by the context menu and keyboard shortcuts.
 *
 * - The context menu maps each action to a `Menu.Item` whose `onClick`
 *   resolves the single right-clicked target and calls `run([target])`.
 * - `useListShortcuts` listens for `shortcut` and calls `run(selectedTargets)`
 *   when the focus scope is active.
 *
 * Actions are leaves only; submenus, dividers, checkboxes, and dynamic items
 * (e.g. "modify category" submenu) stay in the per-feature menu builder.
 */
export interface ListAction<T> {
  /** Stable id; also used as the menu item key. */
  key: string
  /** Display label for the menu. */
  label: ReactNode
  /** Optional icon for the menu item. */
  icon?: LucideIcon
  /** Whether the action is destructive (red tint). */
  danger?: boolean
  /**
   * `tinykeys` syntax: `'$mod+e'`, `'Backspace'`, `'$mod+Shift+a'`.
   * Omitted = action has no keyboard shortcut (menu-only).
   */
  shortcut?: string
  /** Pretty label rendered in the menu's `extra` slot. */
  shortcutLabel?: ReactNode
  /**
   * Whether the action can act on more than one target at a time.
   * Defaults to `false` — the shortcut only fires when exactly one target
   * is selected.
   */
  multi?: boolean
  /**
   * Predicate to disable the action for a given target set. Return `false`
   * to disable. Both menu and keyboard respect this.
   */
  available?: (targets: T[]) => boolean
  /** Run the action against the resolved target list. */
  run: (targets: T[]) => Promise<void> | void
}

/**
 * Shared class strings for Base UI menu surfaces (ContextMenu, DropdownMenu).
 *
 * Mirrors lobe-ui's `base-ui/DropdownMenu/sharedStyle.ts` in spirit but uses
 * Tailwind/UnoCSS utility classes so a single source of truth covers both
 * menu primitives.
 *
 * Conventions:
 * - `item` adds the `group` class so descendant slots can react to parent
 *   data-attributes (e.g. `group-data-[danger]:text-red-500`).
 * - Apply `data-danger=""` on the Item/SubmenuTrigger element to enable
 *   danger styling — both background and icon color cascade from there.
 * - Highlight cascades across hover (`data-[highlighted]`), submenu-open
 *   state (`data-[popup-open]`, `data-[state=open]`, `aria-expanded`), and
 *   disabled state (`data-[disabled]`).
 */
export const menuStyles = {
  /**
   * Popup container. Use on `<Menu.Popup>` / `<ContextMenu.Popup>`.
   */
  popup:
    'outline-hidden min-w-[12rem] max-w-[22rem] rounded border border-neutral-200 bg-white p-1 text-sm text-neutral-700 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200',

  /**
   * Base item. Apply on `Menu.Item`, `Menu.CheckboxItem`, `Menu.SubmenuTrigger`.
   *
   * Includes `group` so child slots (icon, indicator) can react to the
   * parent's data-attributes via `group-data-[...]:` variants.
   */
  item: 'group outline-hidden relative flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-neutral-700 transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950 data-[popup-open]:bg-neutral-100 data-[popup-open]:text-neutral-950 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-950 aria-expanded:bg-neutral-100 aria-expanded:text-neutral-950 dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-800 dark:data-[highlighted]:text-neutral-50 dark:data-[popup-open]:bg-neutral-800 dark:data-[popup-open]:text-neutral-50 dark:data-[state=open]:bg-neutral-800 dark:data-[state=open]:text-neutral-50 dark:aria-expanded:bg-neutral-800 dark:aria-expanded:text-neutral-50',

  /**
   * Modifier applied alongside `item` for destructive actions.
   * Pair with `data-danger=""` on the same element so icon slots can pick
   * up the red tint via `group-data-[danger]:`.
   */
  danger:
    'text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 data-[popup-open]:bg-red-50 data-[popup-open]:text-red-700 data-[state=open]:bg-red-50 data-[state=open]:text-red-700 aria-expanded:bg-red-50 aria-expanded:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-950/30 dark:data-[highlighted]:text-red-300 dark:data-[popup-open]:bg-red-950/30 dark:data-[popup-open]:text-red-300 dark:data-[state=open]:bg-red-950/30 dark:data-[state=open]:text-red-300 dark:aria-expanded:bg-red-950/30 dark:aria-expanded:text-red-300',

  /** Horizontal divider line. */
  separator: 'mx-1 my-1 h-px bg-neutral-200 dark:bg-neutral-800',

  /** Section heading inside a menu group. */
  groupLabel:
    'px-2 py-1 text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500',

  /**
   * Leading icon container. Inherits red tint when its parent `item` has
   * `data-danger=""`.
   */
  iconSlot:
    'flex size-4 shrink-0 items-center justify-center text-neutral-400 group-data-[danger]:text-red-500 dark:text-neutral-500 dark:group-data-[danger]:text-red-400',

  /** Primary label cell — truncates inside a flex parent. */
  label: 'min-w-0 flex-1 truncate',

  /** Secondary description shown under the label. */
  desc: 'mt-0.5 truncate text-xs text-neutral-400',

  /** Right-aligned auxiliary text (shortcut hint, etc.). */
  extra: 'ml-auto shrink-0 pl-3 text-xs text-neutral-400 dark:text-neutral-500',

  /** Chevron next to a submenu trigger. */
  submenuArrow:
    'ml-auto size-4 shrink-0 text-neutral-400 group-data-[danger]:text-red-500 dark:text-neutral-500 dark:group-data-[danger]:text-red-400',

  /** Right-positioned check indicator when checkbox items co-exist with iconned items. */
  indicatorRight:
    'ml-auto flex size-4 shrink-0 items-center justify-center text-[var(--color-primary)]',

  /** Inline placeholder for an empty submenu. */
  empty: 'pointer-events-none italic opacity-50',
} as const

export type MenuStyleKey = keyof typeof menuStyles

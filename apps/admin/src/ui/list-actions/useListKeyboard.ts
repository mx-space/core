import { useEffect, useMemo, useRef } from 'react'
import type { KeybindingsMap } from 'tinykeys'

import {
  setActiveScope,
  useActiveFocusScopeId,
  useScopeArrowNav,
} from '~/ui/focus-scope'

import type { ListAction } from './types'
import type { ListSelectionAPI } from './useListSelection'
import { useListSelection } from './useListSelection'
import { useListShortcuts } from './useListShortcuts'

export interface UseListKeyboardOptions<T> {
  /** Focus-scope id this hook binds to. Must match the wrapping `<FocusScope id={...}>`. */
  scopeId: string
  /** Current list items. */
  items: T[]
  /** Stable id getter. */
  getId: (item: T) => string
  /** Action registry — wired to keyboard via useListShortcuts. */
  actions: ReadonlyArray<ListAction<T>>
  /** Extra keybindings outside the registry. Overrides default extras and registry shortcuts on key collision. */
  extra?: KeybindingsMap
  /** Whether to install the default `$mod+a` / `Escape` extras. Defaults to true. */
  defaultExtras?: boolean
  /** Disable all keyboard bindings. */
  enabled?: boolean
  /** Inject a custom selection model. Defaults to `useListSelection`. */
  selection?: ListSelectionAPI<T>
  /** Dependency array; whenever any element changes, selection is cleared. */
  resetOn?: ReadonlyArray<unknown>
  /** Called immediately before any selection mutation or reset. */
  onBeforeSelectionReset?: () => void
  /**
   * Side-effect fired after arrow-nav focus moves to a new item, AFTER the
   * built-in `selection.selectOne(id)`. Use to push a route, sync external
   * state, etc. Selection is always updated — there is no way to suppress it
   * (single-row focus implies single-row selection).
   */
  onItemFocus?: (id: string) => void
}

export interface UseListKeyboardAPI<T> {
  selection: ListSelectionAPI<T>
  scopeId: string
}

function safeCall(fn: (() => void) | undefined, label: string) {
  if (!fn) return
  try {
    fn()
  } catch (error) {
    console.error(`[useListKeyboard] ${label} threw:`, error)
  }
}

/**
 * Compose selection + shortcuts + arrow-nav into one configuration surface.
 *
 * Shortcut precedence (later overrides earlier on key collision):
 *   1. Action registry shortcuts (`actions[*].shortcut`)
 *   2. Default extras (`$mod+a`, `Escape`) when `defaultExtras !== false`
 *   3. Caller `extra`
 *
 * In development a `console.warn` fires when caller `extra` collides with a
 * registered action shortcut, so accidental overrides are visible.
 *
 * Selection-reset coupling: any mutation of the returned `selection`
 * (`selectOne`, `toggle`, `toggleWithAnchor`, `selectRange`, `selectAll`,
 * `clear`) calls `onBeforeSelectionReset()` first. Use this to keep
 * feature-local state (e.g. comments' `selectAllMode`) in sync without
 * sprinkling resets across the view.
 */
export function useListKeyboard<T>(
  options: UseListKeyboardOptions<T>,
): UseListKeyboardAPI<T> {
  const baseSelection = useListSelection<T>({
    getId: options.getId,
    items: options.items,
  })
  const selection = options.selection ?? baseSelection

  const onBeforeRef = useRef(options.onBeforeSelectionReset)
  onBeforeRef.current = options.onBeforeSelectionReset
  const onItemFocusRef = useRef(options.onItemFocus)
  onItemFocusRef.current = options.onItemFocus
  const itemsRef = useRef(options.items)
  itemsRef.current = options.items
  const getIdRef = useRef(options.getId)
  getIdRef.current = options.getId

  const patchedSelection = useMemo<ListSelectionAPI<T>>(() => {
    const before = () => safeCall(onBeforeRef.current, 'onBeforeSelectionReset')
    return {
      ...selection,
      clear: () => {
        before()
        selection.clear()
      },
      selectAll: () => {
        before()
        selection.selectAll()
      },
      selectOne: (id) => {
        before()
        selection.selectOne(id)
      },
      selectRange: (id) => {
        before()
        selection.selectRange(id)
      },
      // setCursor is implicit-only; explicit set is untouched, no reset hook.
      setCursor: selection.setCursor,
      toggle: (id) => {
        before()
        selection.toggle(id)
      },
      toggleWithAnchor: (id) => {
        before()
        selection.toggleWithAnchor(id)
      },
    }
  }, [selection])

  // The shortcut binding in useListShortcuts is locked to its first-mount
  // closure (effect deps key off shortcut keys, not patched identity). Route
  // every default-extra handler through this ref so subsequent renders see
  // the latest selection state (cursorId, anchorId-driven selectRange, etc.)
  // without forcing a re-bind on every state change.
  const selectionRef = useRef(patchedSelection)
  selectionRef.current = patchedSelection

  const defaultExtras = options.defaultExtras !== false
  const callerExtra = options.extra

  // Detect collisions between caller extra and action registry shortcuts (dev only).
  if (import.meta.env.DEV && callerExtra) {
    const actionKeys = new Set(
      options.actions
        .map((action) => action.shortcut)
        .filter((s): s is string => Boolean(s)),
    )
    for (const key of Object.keys(callerExtra)) {
      if (actionKeys.has(key)) {
        console.warn(
          `[useListKeyboard] caller extra "${key}" overrides action shortcut on scope "${options.scopeId}"`,
        )
      }
    }
  }

  const mergedExtra = useMemo<KeybindingsMap>(() => {
    const map: KeybindingsMap = {}
    if (defaultExtras) {
      // Toggle semantics: first press selects all, second clears. Matches
      // mail-client conventions and keeps the binding reversible without an
      // extra Escape press.
      map['$mod+a'] = (event) => {
        event.preventDefault()
        const items = itemsRef.current
        const getId = getIdRef.current
        const sel = selectionRef.current
        const allSelected =
          items.length > 0 && items.every((item) => sel.isSelected(getId(item)))
        if (allSelected) sel.clear()
        else sel.selectAll()
      }
      map['Escape'] = () => {
        selectionRef.current.clear()
        setActiveScope(null)
      }
      // Space toggles explicit (checkbox) selection on the cursor row. The
      // cursor moves implicitly via hjkl / row-body click and does NOT
      // disturb the checked set — Space is what promotes the cursor to
      // checked, or demotes a checked row back. Falls back to walking up
      // from `document.activeElement` when no cursor is set (e.g. user
      // tabbed into a row without arrow-nav).
      map['Space'] = (event) => {
        const sel = selectionRef.current
        let id = sel.cursorId
        if (!id) {
          const active = document.activeElement
          if (active instanceof HTMLElement) {
            const row = active.closest<HTMLElement>('[data-scope-item="row"]')
            id = row?.getAttribute('data-id') ?? null
          }
        }
        if (!id) return
        event.preventDefault()
        sel.toggleWithAnchor(id)
      }
      // Cursor-anchored range extension. Shift+Arrow / Shift+J / Shift+K moves
      // the cursor to the neighbour row and extends the explicit selection
      // from the previous range anchor to that neighbour. No-ops when the
      // cursor is unset or already at the list boundary.
      const advanceRange = (dir: 1 | -1) => (event: KeyboardEvent) => {
        const items = itemsRef.current
        const getId = getIdRef.current
        const sel = selectionRef.current
        const cursor = sel.cursorId
        if (!cursor) return
        const idx = items.findIndex((it) => getId(it) === cursor)
        if (idx < 0) return
        const nextIdx = idx + dir
        if (nextIdx < 0 || nextIdx >= items.length) return
        event.preventDefault()
        const nextId = getId(items[nextIdx])
        sel.setCursor(nextId)
        sel.selectRange(nextId)
      }
      map['Shift+ArrowDown'] = advanceRange(1)
      map['Shift+ArrowUp'] = advanceRange(-1)
      map['Shift+j'] = advanceRange(1)
      map['Shift+k'] = advanceRange(-1)
    }
    if (callerExtra) {
      for (const [key, handler] of Object.entries(callerExtra)) {
        map[key] = handler
      }
    }
    return map
    // patchedSelection identity changes with selection state but the handlers
    // read from the latest patchedSelection via closure; rebinding on every
    // change keeps semantics simple and matches useListShortcuts' own rebind
    // policy.
  }, [defaultExtras, callerExtra, patchedSelection])

  // Action targets: explicit checked set if any, else fall back to the
  // cursor row. Lets keyboard actions (Enter/Backspace/...) operate on the
  // implicitly-focused row when the user hasn't Space-checked anything.
  const getActionTargets = (): T[] => {
    const explicit = selection.getSelectedTargets()
    if (explicit.length > 0) return explicit
    const cid = selection.cursorId
    if (!cid) return []
    const getId = getIdRef.current
    const item = itemsRef.current.find((entry) => getId(entry) === cid)
    return item ? [item] : []
  }

  useListShortcuts(options.actions, {
    enabled: options.enabled,
    extra: mergedExtra,
    getTargets: getActionTargets,
    scopeId: options.scopeId,
  })

  useScopeArrowNav({
    enabled: options.enabled,
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (el) => {
      const id = el.getAttribute('data-id')
      if (!id) return
      // Arrow-nav sets the cursor (implicit). It does NOT touch the explicit
      // checked set — pressing j/k after Space-checking a row preserves the
      // check. Use Space to promote the cursor row to checked.
      patchedSelection.setCursor(id)
      const custom = onItemFocusRef.current
      if (custom) safeCall(() => custom(id), 'onItemFocus')
    },
    scopeId: options.scopeId,
  })

  // Clear the cursor when the user leaves this scope (via h/l, click into
  // sidebar, etc.). The explicit checked set survives — only the implicit
  // mark disappears. When the user comes back, the scope switcher restores
  // focus to the last-focused item which re-fires onItemFocus and re-sets
  // the cursor.
  const activeScopeId = useActiveFocusScopeId()
  useEffect(() => {
    if (activeScopeId !== options.scopeId) {
      patchedSelection.setCursor(null)
    }
  }, [activeScopeId, options.scopeId, patchedSelection])

  const resetOn = options.resetOn
  useEffect(() => {
    patchedSelection.clear()
    // patchedSelection.clear already calls onBeforeSelectionReset internally.
  }, resetOn ?? [])

  return { scopeId: options.scopeId, selection: patchedSelection }
}

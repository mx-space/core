import { useEffect, useMemo, useRef } from 'react'
import type { KeybindingsMap } from 'tinykeys'
import type { ListAction } from './types'
import type { ListSelectionAPI } from './useListSelection'

import { setActiveScope, useScopeArrowNav } from '~/ui/focus-scope'

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
   * Called after arrow-nav focus moves to a new item. Default:
   * `selection.selectOne(id)`. Override to suppress or customize.
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
    // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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
        const allSelected =
          items.length > 0 &&
          items.every((item) => patchedSelection.isSelected(getId(item)))
        if (allSelected) patchedSelection.clear()
        else patchedSelection.selectAll()
      }
      map['Escape'] = () => {
        patchedSelection.clear()
        setActiveScope(null)
      }
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

  useListShortcuts(options.actions, {
    enabled: options.enabled,
    extra: mergedExtra,
    getTargets: selection.getSelectedTargets,
    scopeId: options.scopeId,
  })

  useScopeArrowNav({
    enabled: options.enabled,
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (el) => {
      const id = el.getAttribute('data-id')
      if (!id) return
      const custom = onItemFocusRef.current
      if (custom) {
        safeCall(() => custom(id), 'onItemFocus')
        return
      }
      patchedSelection.selectOne(id)
    },
    scopeId: options.scopeId,
  })

  const resetOn = options.resetOn
  useEffect(() => {
    patchedSelection.clear()
    // patchedSelection.clear already calls onBeforeSelectionReset internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetOn ?? [])

  return { scopeId: options.scopeId, selection: patchedSelection }
}

import { useCallback, useMemo, useRef, useState } from 'react'

export interface UseListSelectionOptions<T> {
  /** Current list of items (used for resolving selected ids back to targets). */
  items: T[]
  /** Extract the stable id of an item. */
  getId: (item: T) => string
}

export interface ListSelectionAPI<T> {
  /** Explicit (checked) selection set. */
  selectedIds: Set<string>
  /** True iff id is in the explicit (checked) set. */
  isSelected: (id: string) => boolean
  /** Explicit selection size. */
  size: number
  /** Get the resolved targets for the explicit selection. */
  getSelectedTargets: () => T[]
  /** Toggle one id in the explicit set (checkbox click). */
  toggle: (id: string) => void
  /** Set the explicit set to a single id. */
  selectOne: (id: string) => void
  /** Range-select from the last anchor to this id; falls back to selectOne if no anchor. */
  selectRange: (id: string) => void
  /** Toggle in the explicit set and use this id as the new range anchor. */
  toggleWithAnchor: (id: string) => void
  /** Select every visible item (explicit). */
  selectAll: () => void
  /** Clear BOTH explicit selection and cursor. */
  clear: () => void
  /**
   * Implicit "cursor" — the row most recently focused via keyboard / click.
   * Lives outside the explicit set: arrow nav and row-body clicks update it
   * without disturbing checked items. `null` when no cursor (e.g. after the
   * scope is deactivated).
   */
  cursorId: string | null
  /** True iff id is the cursor. */
  isCursor: (id: string) => boolean
  /** Set the cursor (pass `null` to clear). */
  setCursor: (id: string | null) => void
}

/**
 * Manage list selection state with anchor support for shift-range selection.
 *
 * Selected ids are stored as a `Set<string>`. Resolution from id back to T
 * happens lazily via `getSelectedTargets()` so the latest `items` reference
 * is used (handy when the list re-fetches).
 */
export function useListSelection<T>(
  options: UseListSelectionOptions<T>,
): ListSelectionAPI<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [cursorId, setCursorIdState] = useState<string | null>(null)

  // Hold latest items/getId in a ref so getSelectedTargets is always current
  // without needing to memoize callers around items.
  const itemsRef = useRef(options.items)
  itemsRef.current = options.items
  const getIdRef = useRef(options.getId)
  getIdRef.current = options.getId

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectOne = useCallback((id: string) => {
    setSelectedIds(new Set([id]))
    setAnchorId(id)
  }, [])

  const toggleWithAnchor = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setAnchorId(id)
  }, [])

  const selectRange = useCallback(
    (id: string) => {
      const items = itemsRef.current
      const getId = getIdRef.current
      if (!anchorId) {
        selectOne(id)
        return
      }
      const ids = items.map(getId)
      const aIndex = ids.indexOf(anchorId)
      const bIndex = ids.indexOf(id)
      if (aIndex < 0 || bIndex < 0) {
        selectOne(id)
        return
      }
      const [lo, hi] = aIndex <= bIndex ? [aIndex, bIndex] : [bIndex, aIndex]
      const next = new Set(ids.slice(lo, hi + 1))
      setSelectedIds(next)
    },
    [anchorId, selectOne],
  )

  const selectAll = useCallback(() => {
    const items = itemsRef.current
    const getId = getIdRef.current
    setSelectedIds(new Set(items.map(getId)))
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
    setAnchorId(null)
    setCursorIdState(null)
  }, [])

  const isCursor = useCallback((id: string) => cursorId === id, [cursorId])

  const setCursor = useCallback((id: string | null) => {
    setCursorIdState((current) => (current === id ? current : id))
  }, [])

  const getSelectedTargets = useCallback((): T[] => {
    const items = itemsRef.current
    const getId = getIdRef.current
    if (selectedIds.size === 0) return []
    const out: T[] = []
    for (const item of items) {
      if (selectedIds.has(getId(item))) out.push(item)
    }
    return out
  }, [selectedIds])

  return useMemo(
    () => ({
      clear,
      cursorId,
      getSelectedTargets,
      isCursor,
      isSelected,
      selectAll,
      selectedIds,
      selectOne,
      selectRange,
      setCursor,
      size: selectedIds.size,
      toggle,
      toggleWithAnchor,
    }),
    [
      clear,
      cursorId,
      getSelectedTargets,
      isCursor,
      isSelected,
      selectAll,
      selectedIds,
      selectOne,
      selectRange,
      setCursor,
      toggle,
      toggleWithAnchor,
    ],
  )
}

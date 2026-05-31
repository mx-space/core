import { shallow } from 'zustand/shallow'
import { createWithEqualityFn } from 'zustand/traditional'

interface SidebarExpandState {
  expanded: Set<string>
  isExpanded: (path: string) => boolean
  expand: (path: string) => void
  collapse: (path: string) => void
  toggle: (path: string) => void
  /** Ensure each given path is expanded. No-op if already expanded. */
  ensureExpanded: (paths: ReadonlyArray<string>) => void
}

export const useSidebarExpandStore = createWithEqualityFn<SidebarExpandState>()(
  (set, get) => ({
    expanded: new Set<string>(),
    isExpanded: (path) => get().expanded.has(path),
    expand: (path) => {
      const current = get().expanded
      if (current.has(path)) return
      const next = new Set(current)
      next.add(path)
      set({ expanded: next })
    },
    collapse: (path) => {
      const current = get().expanded
      if (!current.has(path)) return
      const next = new Set(current)
      next.delete(path)
      set({ expanded: next })
    },
    toggle: (path) => {
      const current = get().expanded
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      set({ expanded: next })
    },
    ensureExpanded: (paths) => {
      const current = get().expanded
      let changed = false
      const next = new Set(current)
      for (const path of paths) {
        if (next.has(path)) continue
        next.add(path)
        changed = true
      }
      if (changed) set({ expanded: next })
    },
  }),
  shallow,
)

/** Imperative read, callable outside React. */
export function isPathExpanded(path: string): boolean {
  return useSidebarExpandStore.getState().expanded.has(path)
}

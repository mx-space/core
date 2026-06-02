import type { PropsWithChildren, ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { tinykeys } from 'tinykeys'

import { ShortcutOverlay } from './ShortcutOverlay'

export interface ShortcutItem {
  /** Display group, e.g. 'Navigation', 'Selection', 'Action'. */
  group: string
  /** Stable key — used both as the React key and as a duplicate guard. */
  key: string
  /** Pretty label rendered on the right (e.g. 'E', '⌥E', 'g u'). */
  label: ReactNode
  /** Optional helper line describing what the shortcut does. */
  hint?: ReactNode
}

interface RegistryEntry {
  id: number
  items: ReadonlyArray<ShortcutItem>
}

interface KeyboardShortcutsContextValue {
  register: (items: ReadonlyArray<ShortcutItem>) => () => void
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: boolean
  entries: ReadonlyArray<RegistryEntry>
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null)

export function useKeyboardShortcutsContext(): KeyboardShortcutsContextValue {
  const ctx = useContext(KeyboardShortcutsContext)
  if (!ctx) {
    throw new Error(
      'useKeyboardShortcutsContext must be used inside <KeyboardShortcutsProvider>',
    )
  }
  return ctx
}

let entryIdSeq = 0

/**
 * Holds a per-route stack of shortcut registrations and exposes the `?`-toggled
 * overlay. The provider does NOT bake any shortcuts in — every entry comes
 * from a route's `useRegisterShortcuts` call. The overlay reads the flat list
 * of registered entries on each render, so unmounting a route hides its
 * group cleanly.
 *
 * Mount once near the application root.
 */
export function KeyboardShortcutsProvider(props: PropsWithChildren) {
  const [entries, setEntries] = useState<ReadonlyArray<RegistryEntry>>([])
  const [isOpen, setIsOpen] = useState(false)

  const register = useCallback((items: ReadonlyArray<ShortcutItem>) => {
    const id = ++entryIdSeq
    setEntries((current) => [...current, { id, items }])
    return () => {
      setEntries((current) => current.filter((entry) => entry.id !== id))
    }
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((value) => !value), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return tinykeys(window, {
      'Shift+?': (event) => {
        const target = event.target
        if (
          target instanceof HTMLElement &&
          target.matches('input, textarea, select, [contenteditable="true"]')
        ) {
          return
        }
        event.preventDefault()
        setIsOpen((value) => !value)
      },
    })
  }, [])

  const value = useMemo<KeyboardShortcutsContextValue>(
    () => ({
      close,
      entries,
      isOpen,
      open,
      register,
      toggle,
    }),
    [close, entries, isOpen, open, register, toggle],
  )

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {props.children}
      <ShortcutOverlay entries={entries} onClose={close} open={isOpen} />
    </KeyboardShortcutsContext.Provider>
  )
}

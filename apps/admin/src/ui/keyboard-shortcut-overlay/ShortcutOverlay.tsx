import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '~/utils/cn'

import type { ShortcutItem } from './KeyboardShortcutsProvider'

interface RegistryEntry {
  id: number
  items: ReadonlyArray<ShortcutItem>
}

export interface ShortcutOverlayProps {
  open: boolean
  entries: ReadonlyArray<RegistryEntry>
  onClose: () => void
}

interface GroupedShortcuts {
  group: string
  items: ShortcutItem[]
}

function flattenEntries(
  entries: ReadonlyArray<RegistryEntry>,
): GroupedShortcuts[] {
  const order: string[] = []
  const map = new Map<string, ShortcutItem[]>()
  const seenKeys = new Set<string>()
  for (const entry of entries) {
    for (const item of entry.items) {
      if (seenKeys.has(item.key)) continue
      seenKeys.add(item.key)
      const list = map.get(item.group)
      if (list) {
        list.push(item)
      } else {
        order.push(item.group)
        map.set(item.group, [item])
      }
    }
  }
  return order.map((group) => ({ group, items: map.get(group) ?? [] }))
}

/**
 * Comments-agnostic overlay — knows only the {group, key, label, hint}
 * registry shape. Esc closes; the backdrop click closes; the X button
 * closes. Tokens come from DS v2 (`bg-surface-overlay`, `rounded-xl`,
 * `shadow-lg`).
 */
export function ShortcutOverlay(props: ShortcutOverlayProps) {
  const { open, entries, onClose } = props

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const groups = useMemo(() => flattenEntries(entries), [entries])

  if (typeof document === 'undefined') return null
  if (!open) return null

  return createPortal(
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      data-testid="shortcut-overlay-root"
    >
      <button
        aria-label="Close shortcuts overlay"
        className="absolute inset-0 cursor-default bg-black/35"
        data-testid="shortcut-overlay-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="shortcut-overlay-title"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[80vh] w-[min(640px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl bg-surface-overlay shadow-lg',
        )}
        data-testid="shortcut-overlay-card"
        role="dialog"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-6">
          <h2
            className="text-lg font-semibold text-fg"
            id="shortcut-overlay-title"
          >
            Keyboard shortcuts
          </h2>
          <button
            aria-label="Close"
            className="-mr-2.5 inline-flex size-9 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-muted">
              No shortcuts registered for the current view.
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map(({ group, items }) => (
                <section key={group}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {group}
                  </h3>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li
                        className="flex items-center justify-between gap-4 text-sm"
                        key={item.key}
                      >
                        <span className="min-w-0 text-fg">
                          {item.hint ?? item.label}
                        </span>
                        <kbd className="ml-auto inline-flex shrink-0 items-center justify-center rounded-sm bg-surface-inset px-2 py-0.5 font-mono text-xs text-fg-muted">
                          {item.label}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

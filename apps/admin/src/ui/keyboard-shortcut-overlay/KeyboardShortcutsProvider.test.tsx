import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ShortcutItem } from './KeyboardShortcutsProvider'
import { KeyboardShortcutsProvider } from './KeyboardShortcutsProvider'
import { useRegisterShortcuts } from './useRegisterShortcuts'

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function dispatchKey(init: KeyboardEventInit & { code?: string }) {
  act(() => {
    const event = new KeyboardEvent('keydown', { bubbles: true, ...init })
    const code = init.code ?? deriveCode(init.key ?? '')
    if (!event.code) {
      Object.defineProperty(event, 'code', { configurable: true, value: code })
    }
    if (typeof event.getModifierState !== 'function') {
      Object.defineProperty(event, 'getModifierState', {
        configurable: true,
        value: (mod: string) => {
          if (mod === 'Shift') return Boolean(init.shiftKey)
          if (mod === 'Control') return Boolean(init.ctrlKey)
          if (mod === 'Alt') return Boolean(init.altKey)
          if (mod === 'Meta') return Boolean(init.metaKey)
          return false
        },
      })
    }
    window.dispatchEvent(event)
  })
}

function deriveCode(key: string): string {
  if (key === '?') return 'Slash'
  if (key.length === 1 && /[a-z]/i.test(key)) return `Key${key.toUpperCase()}`
  return key
}

function Registrant({
  items,
  unregisterOnHide,
  hide,
}: {
  items: ShortcutItem[]
  unregisterOnHide?: boolean
  hide?: boolean
}) {
  // Honour the unmount probe — return null when `hide` is set so the
  // registering subtree is torn down and the provider observes the cleanup.
  if (hide && unregisterOnHide) return null
  return createElement(RegistrantInner, { items })
}

function RegistrantInner({ items }: { items: ShortcutItem[] }) {
  useRegisterShortcuts(items)
  return null
}

function getOverlayRoot(): HTMLElement | null {
  return document.querySelector('[data-testid="shortcut-overlay-root"]')
}

function getOverlayCard(): HTMLElement | null {
  return document.querySelector('[data-testid="shortcut-overlay-card"]')
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('KeyboardShortcutsProvider', () => {
  it('registers items on mount and unregisters them on unmount', () => {
    const items: ShortcutItem[] = [
      { group: 'Navigation', key: 'g-u', label: 'g u', hint: 'Go to unread' },
    ]
    act(() => {
      harness.root.render(
        createElement(KeyboardShortcutsProvider, {
          children: createElement(Registrant, {
            hide: false,
            items,
            unregisterOnHide: true,
          }),
        }),
      )
    })

    // Open overlay via ?
    dispatchKey({ key: '?', shiftKey: true })
    expect(getOverlayRoot()).not.toBeNull()
    const cardText = getOverlayCard()?.textContent ?? ''
    expect(cardText).toContain('Navigation')
    expect(cardText).toContain('Go to unread')
    expect(cardText).toContain('g u')

    // Close overlay
    dispatchKey({ key: 'Escape' })
    expect(getOverlayRoot()).toBeNull()

    // Unregister by hiding the subtree
    act(() => {
      harness.root.render(
        createElement(KeyboardShortcutsProvider, {
          children: createElement(Registrant, {
            hide: true,
            items,
            unregisterOnHide: true,
          }),
        }),
      )
    })

    // Open overlay again — the previously registered items should be gone
    dispatchKey({ key: '?', shiftKey: true })
    const cardAfter = getOverlayCard()?.textContent ?? ''
    expect(cardAfter).not.toContain('Go to unread')
  })

  it('? toggles the overlay (open then close)', () => {
    act(() => {
      harness.root.render(
        createElement(KeyboardShortcutsProvider, {
          children: createElement('div', null, 'app'),
        }),
      )
    })

    expect(getOverlayRoot()).toBeNull()
    dispatchKey({ key: '?', shiftKey: true })
    expect(getOverlayRoot()).not.toBeNull()
    dispatchKey({ key: '?', shiftKey: true })
    expect(getOverlayRoot()).toBeNull()
  })

  it('? does not toggle while the user is typing into a text input', () => {
    act(() => {
      harness.root.render(
        createElement(KeyboardShortcutsProvider, {
          children: createElement('input', {
            'data-testid': 'probe-input',
            type: 'text',
          }),
        }),
      )
    })
    const input = document.querySelector(
      '[data-testid="probe-input"]',
    ) as HTMLInputElement
    expect(input).not.toBeNull()
    input.focus()

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      key: '?',
      shiftKey: true,
    })
    Object.defineProperty(event, 'code', {
      configurable: true,
      value: 'Slash',
    })
    Object.defineProperty(event, 'getModifierState', {
      configurable: true,
      value: (mod: string) => mod === 'Shift',
    })
    // Dispatching on the input lets target.matches('input,...') reject.
    act(() => {
      input.dispatchEvent(event)
    })
    expect(getOverlayRoot()).toBeNull()
  })

  it('Esc closes the overlay', () => {
    act(() => {
      harness.root.render(
        createElement(KeyboardShortcutsProvider, {
          children: createElement('div', null, 'app'),
        }),
      )
    })
    dispatchKey({ key: '?', shiftKey: true })
    expect(getOverlayRoot()).not.toBeNull()
    dispatchKey({ key: 'Escape' })
    expect(getOverlayRoot()).toBeNull()
  })

  it('merges entries across multiple registrants, grouped by `group`', () => {
    const navItems: ShortcutItem[] = [
      { group: 'Navigation', key: 'g-u', label: 'g u', hint: 'Go to unread' },
    ]
    const actionItems: ShortcutItem[] = [
      { group: 'Action', key: 'mark-read', label: 'E', hint: 'Mark as read' },
    ]
    act(() => {
      harness.root.render(
        createElement(KeyboardShortcutsProvider, {
          children: [
            createElement(RegistrantInner, { items: navItems, key: 'nav' }),
            createElement(RegistrantInner, {
              items: actionItems,
              key: 'action',
            }),
          ],
        }),
      )
    })

    dispatchKey({ key: '?', shiftKey: true })
    const text = getOverlayCard()?.textContent ?? ''
    expect(text).toContain('Navigation')
    expect(text).toContain('Go to unread')
    expect(text).toContain('Action')
    expect(text).toContain('Mark as read')
  })
})

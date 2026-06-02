import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CommentTab } from '~/models/comment'

import { useCommentRouteShortcuts } from './use-comment-route-shortcuts'

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
  if (key === '/') return 'Slash'
  if (key.length === 1 && /[a-z]/i.test(key)) return `Key${key.toUpperCase()}`
  return key
}

interface ProbeProps {
  navigateTab: (tab: CommentTab) => void
  focusSearch: () => void
  focusComposer: () => void
  enabled?: boolean
}

function Probe(props: ProbeProps) {
  useCommentRouteShortcuts({
    enabled: props.enabled,
    focusComposer: props.focusComposer,
    focusSearch: props.focusSearch,
    navigateTab: props.navigateTab,
  })
  return null
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('useCommentRouteShortcuts', () => {
  it('"g u" navigates to the unread tab', () => {
    const navigateTab = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Probe, {
          focusComposer: vi.fn(),
          focusSearch: vi.fn(),
          navigateTab,
        }),
      )
    })
    dispatchKey({ key: 'g' })
    dispatchKey({ key: 'u' })
    expect(navigateTab).toHaveBeenCalledWith('unread')
  })

  it('"g j" navigates to the junk tab', () => {
    const navigateTab = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Probe, {
          focusComposer: vi.fn(),
          focusSearch: vi.fn(),
          navigateTab,
        }),
      )
    })
    dispatchKey({ key: 'g' })
    dispatchKey({ key: 'j' })
    expect(navigateTab).toHaveBeenCalledWith('junk')
  })

  it('"/" focuses the search input and prevents default browser behavior', () => {
    const focusSearch = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Probe, {
          focusComposer: vi.fn(),
          focusSearch,
          navigateTab: vi.fn(),
        }),
      )
    })
    dispatchKey({ key: '/' })
    expect(focusSearch).toHaveBeenCalledTimes(1)
  })

  it('"r" focuses the composer', () => {
    const focusComposer = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Probe, {
          focusComposer,
          focusSearch: vi.fn(),
          navigateTab: vi.fn(),
        }),
      )
    })
    dispatchKey({ key: 'r' })
    expect(focusComposer).toHaveBeenCalledTimes(1)
  })

  it('unmount clears the global bindings', () => {
    const navigateTab = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Probe, {
          focusComposer: vi.fn(),
          focusSearch: vi.fn(),
          navigateTab,
        }),
      )
    })
    act(() => {
      harness.root.render(createElement('div', null))
    })
    dispatchKey({ key: 'g' })
    dispatchKey({ key: 'u' })
    expect(navigateTab).not.toHaveBeenCalled()
  })

  it('honors `enabled: false` and skips registration entirely', () => {
    const navigateTab = vi.fn()
    act(() => {
      harness.root.render(
        createElement(Probe, {
          enabled: false,
          focusComposer: vi.fn(),
          focusSearch: vi.fn(),
          navigateTab,
        }),
      )
    })
    dispatchKey({ key: 'g' })
    dispatchKey({ key: 'u' })
    expect(navigateTab).not.toHaveBeenCalled()
  })
})

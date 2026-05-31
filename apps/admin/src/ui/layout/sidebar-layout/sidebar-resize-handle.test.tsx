import { Provider as JotaiProvider } from 'jotai'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SIDEBAR_WIDTH_MAX } from '~/constants/layout'
import { jotaiStore } from '~/store/jotai-store'

import {
  effectiveSidebarWidthAtom,
  sidebarCollapsedAtom,
  sidebarLiveWidthAtom,
  sidebarWidthAtom,
} from './atoms'
import { SidebarResizeHandle } from './sidebar-resize-handle'

interface Harness {
  root: Root
  container: HTMLDivElement
  handle: HTMLElement
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      createElement(
        JotaiProvider,
        { store: jotaiStore },
        createElement(SidebarResizeHandle),
      ),
    )
  })
  const handle = container.querySelector(
    '[role="separator"]',
  ) as HTMLElement | null
  if (!handle) throw new Error('handle not mounted')
  return {
    root,
    container,
    handle,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function makePointer(type: string, clientX: number, pointerId = 1) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, {
    clientX,
    pointerId,
    pointerType: 'mouse',
    button: 0,
  })
  return ev as unknown as PointerEvent
}

let harness: Harness | null = null

beforeEach(() => {
  localStorage.clear()
  jotaiStore.set(sidebarCollapsedAtom, false)
  jotaiStore.set(sidebarWidthAtom, 240)
  jotaiStore.set(sidebarLiveWidthAtom, null)
  document.documentElement.style.removeProperty('--sidebar-width')
  delete document.body.dataset.sidebarResizing
})

afterEach(() => {
  harness?.unmount()
  harness = null
  delete document.body.dataset.sidebarResizing
  jotaiStore.set(sidebarLiveWidthAtom, null)
  localStorage.clear()
})

describe('SidebarResizeHandle', () => {
  it('marks body data-sidebar-resizing on pointerdown', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
    })
    expect(document.body.dataset.sidebarResizing).toBe('true')
  })

  it('pointermove updates live width and CSS var; persisted width stays put until commit', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
    })
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointermove', 300))
    })
    expect(jotaiStore.get(sidebarLiveWidthAtom)).toBe(300)
    expect(jotaiStore.get(effectiveSidebarWidthAtom)).toBe(300)
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(240) // not yet committed
    expect(
      document.documentElement.style.getPropertyValue('--sidebar-width'),
    ).toBe('300px')
  })

  it('commits live width to persisted on pointerup when expanded', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointermove', 300))
      harness!.handle.dispatchEvent(makePointer('pointerup', 300))
    })
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(300)
    expect(jotaiStore.get(sidebarLiveWidthAtom)).toBeNull()
    expect(jotaiStore.get(effectiveSidebarWidthAtom)).toBe(300)
  })

  it('clamps live width when pointermove exceeds MAX', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointermove', 500))
    })
    expect(jotaiStore.get(sidebarLiveWidthAtom)).toBe(SIDEBAR_WIDTH_MAX)
  })

  it('drag below collapse threshold sets collapsed without writing persisted width', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointermove', 80))
    })
    expect(jotaiStore.get(sidebarCollapsedAtom)).toBe(true)
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(240) // unchanged
  })

  it('drag-to-collapse must not pollute persisted width even after passing MIN', () => {
    // Reproduces the bug fixed by the live/persisted split:
    // dragging 240 → 80 used to leave persisted width at MIN (200).
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointermove', 220))
      harness!.handle.dispatchEvent(makePointer('pointermove', 180)) // would clamp to MIN
      harness!.handle.dispatchEvent(makePointer('pointermove', 80)) // below threshold
      harness!.handle.dispatchEvent(makePointer('pointerup', 80))
    })
    expect(jotaiStore.get(sidebarCollapsedAtom)).toBe(true)
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(240) // restored, NOT 200
    expect(jotaiStore.get(sidebarLiveWidthAtom)).toBeNull()
    expect(jotaiStore.get(effectiveSidebarWidthAtom)).toBe(240)
  })

  it('dragging back above threshold re-expands and commits the new width', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointermove', 80))
    })
    expect(jotaiStore.get(sidebarCollapsedAtom)).toBe(true)
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointermove', 260))
      harness!.handle.dispatchEvent(makePointer('pointerup', 260))
    })
    expect(jotaiStore.get(sidebarCollapsedAtom)).toBe(false)
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(260)
  })

  it('pointerup clears dataset', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
    })
    expect(document.body.dataset.sidebarResizing).toBe('true')
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerup', 240))
    })
    expect(document.body.dataset.sidebarResizing).toBeUndefined()
  })

  it('pointermove is no-op after pointerup', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointerup', 240))
    })
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointermove', 320))
    })
    expect(jotaiStore.get(sidebarLiveWidthAtom)).toBeNull()
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(240)
  })

  it('window blur ends an in-flight drag and discards live override when collapsed', () => {
    harness = mount()
    act(() => {
      harness!.handle.dispatchEvent(makePointer('pointerdown', 240))
      harness!.handle.dispatchEvent(makePointer('pointermove', 80))
    })
    expect(document.body.dataset.sidebarResizing).toBe('true')
    expect(jotaiStore.get(sidebarCollapsedAtom)).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(document.body.dataset.sidebarResizing).toBeUndefined()
    expect(jotaiStore.get(sidebarLiveWidthAtom)).toBeNull()
    expect(jotaiStore.get(sidebarWidthAtom)).toBe(240)
  })
})

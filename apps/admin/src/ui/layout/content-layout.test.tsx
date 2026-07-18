import { act, createElement, type ReactNode } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import { ContentLayout, ContentLayoutSlot } from '~/ui/layout/content-layout'

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

let clientWidthSpy: { mockRestore: () => void } | null = null

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

function stubMatchMedia(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('1024'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  )
}

function stubLayoutWidth(initialWidth: number) {
  let width = initialWidth
  const callbacks = new Set<ResizeObserverCallback>()

  clientWidthSpy = vi
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockImplementation(() => width)
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverStub {
      private readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        callbacks.add(callback)
      }

      disconnect() {
        callbacks.delete(this.callback)
      }

      observe() {}

      unobserve() {}
    },
  )

  return {
    resize(nextWidth: number) {
      width = nextWidth
      act(() => {
        for (const callback of callbacks) callback([], {} as ResizeObserver)
      })
    },
  }
}

function findScrim(): HTMLElement | null {
  return document.querySelector(
    '[data-testid="bottom-sheet-scrim"]',
  ) as HTMLElement | null
}

function findCloseButton(): HTMLButtonElement | null {
  return document.querySelector(
    'button[aria-label="关闭"]',
  ) as HTMLButtonElement | null
}

function findResizeSeparator(): HTMLElement | null {
  return document.querySelector('[data-content-layout=""] [role="separator"]')
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

function render(element: ReactNode) {
  act(() => {
    harness.root.render(createElement(I18nProvider, null, element))
  })
}

afterEach(() => {
  harness.unmount()
  clientWidthSpy?.mockRestore()
  clientWidthSpy = null
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('ContentLayout', () => {
  it('renders the desktop PanelGroup layout when viewport is at lg or above', () => {
    stubMatchMedia(true)
    render(
      createElement(ContentLayout, {
        open: true,
        onCloseAside: vi.fn(),
        children: createElement('div', null, 'main-content'),
      }),
    )

    const root = document.querySelector('[data-content-layout=""]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-content-layout-mode')).toBeNull()
    expect(findScrim()).toBeNull()
  })

  it('uses a drawer when the desktop layout container is too narrow for both panels', () => {
    stubMatchMedia(true)
    stubLayoutWidth(640)
    const onCloseAside = vi.fn()

    render(
      createElement(ContentLayout, {
        compactAtWidth: 768,
        open: true,
        onCloseAside,
        asideMobileTitle: 'Edit translation',
        children: [
          createElement('div', { key: 'main' }, 'main-content'),
          createElement(ContentLayoutSlot, {
            active: true,
            id: 'foo',
            key: 'slot',
            children: createElement('div', null, 'slot-portal-content'),
          }),
        ],
      }),
    )

    expect(findResizeSeparator()).toBeNull()
    const root = document.querySelector('[data-content-layout=""]')
    expect(root?.getAttribute('data-content-layout-mode')).toBe('compact')
    const drawer = document.querySelector('[role="dialog"]')
    expect(drawer?.textContent).toContain('slot-portal-content')
    expect(onCloseAside).not.toHaveBeenCalled()
  })

  it('switches an open desktop aside to the compact drawer when its container shrinks', () => {
    stubMatchMedia(true)
    const layout = stubLayoutWidth(900)

    render(
      createElement(ContentLayout, {
        compactAtWidth: 768,
        open: true,
        onCloseAside: vi.fn(),
        asideMobileTitle: 'Edit translation',
        children: createElement('div', null, 'main-content'),
      }),
    )

    expect(findResizeSeparator()).not.toBeNull()

    layout.resize(640)

    const root = document.querySelector('[data-content-layout=""]')
    expect(root?.getAttribute('data-content-layout-mode')).toBe('compact')
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('renders a bottom sheet instead of the resize separator on mobile', () => {
    stubMatchMedia(false)
    render(
      createElement(ContentLayout, {
        open: true,
        onCloseAside: vi.fn(),
        children: createElement('div', null, 'main-content'),
      }),
    )

    expect(findResizeSeparator()).toBeNull()
    const root = document.querySelector('[data-content-layout=""]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-content-layout-mode')).toBe('mobile')
    expect(findScrim()).not.toBeNull()
  })

  it('portals ContentLayoutSlot content into the bottom sheet body on mobile', () => {
    stubMatchMedia(false)
    render(
      createElement(ContentLayout, {
        open: true,
        onCloseAside: vi.fn(),
        children: [
          createElement('div', { key: 'main' }, 'main-content'),
          createElement(ContentLayoutSlot, {
            active: true,
            id: 'foo',
            key: 'slot',
            children: createElement('div', null, 'slot-portal-content'),
          }),
        ],
      }),
    )

    const sheet = document.querySelector('[role="dialog"]')
    expect(sheet).not.toBeNull()
    expect(sheet!.textContent).toContain('slot-portal-content')
  })

  it('invokes onCloseAside when the bottom sheet close button is clicked on mobile', () => {
    stubMatchMedia(false)
    const onCloseAside = vi.fn()
    render(
      createElement(ContentLayout, {
        open: true,
        onCloseAside,
        children: createElement('div', null, 'main-content'),
      }),
    )

    act(() => {
      findCloseButton()!.click()
    })
    expect(onCloseAside).toHaveBeenCalledTimes(1)
  })

  it('invokes onCloseAside when the scrim is clicked on mobile', () => {
    stubMatchMedia(false)
    const onCloseAside = vi.fn()
    render(
      createElement(ContentLayout, {
        open: true,
        onCloseAside,
        children: createElement('div', null, 'main-content'),
      }),
    )

    act(() => {
      findScrim()!.click()
    })
    expect(onCloseAside).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onCloseAside on desktop because no close affordance exists', () => {
    stubMatchMedia(true)
    const onCloseAside = vi.fn()
    render(
      createElement(ContentLayout, {
        open: true,
        onCloseAside,
        children: createElement('div', null, 'main-content'),
      }),
    )

    expect(findCloseButton()).toBeNull()
    expect(findScrim()).toBeNull()
    expect(onCloseAside).not.toHaveBeenCalled()
  })
})

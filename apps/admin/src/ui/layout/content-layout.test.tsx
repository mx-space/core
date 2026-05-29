import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Root } from 'react-dom/client'

import { ContentLayout, ContentLayoutSlot } from '~/ui/layout/content-layout'

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

afterEach(() => {
  harness.unmount()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('ContentLayout', () => {
  it('renders the desktop PanelGroup layout when viewport is at lg or above', () => {
    stubMatchMedia(true)
    act(() => {
      harness.root.render(
        createElement(ContentLayout, {
          open: true,
          onCloseAside: vi.fn(),
          children: createElement('div', null, 'main-content'),
        }),
      )
    })

    const root = document.querySelector('[data-content-layout=""]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-content-layout-mode')).toBeNull()
    expect(findScrim()).toBeNull()
  })

  it('renders a bottom sheet instead of the resize separator on mobile', () => {
    stubMatchMedia(false)
    act(() => {
      harness.root.render(
        createElement(ContentLayout, {
          open: true,
          onCloseAside: vi.fn(),
          children: createElement('div', null, 'main-content'),
        }),
      )
    })

    expect(findResizeSeparator()).toBeNull()
    const root = document.querySelector('[data-content-layout=""]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-content-layout-mode')).toBe('mobile')
    expect(findScrim()).not.toBeNull()
  })

  it('portals ContentLayoutSlot content into the bottom sheet body on mobile', () => {
    stubMatchMedia(false)
    act(() => {
      harness.root.render(
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
    })

    const sheet = document.querySelector('[role="dialog"]')
    expect(sheet).not.toBeNull()
    expect(sheet!.textContent).toContain('slot-portal-content')
  })

  it('invokes onCloseAside when the bottom sheet close button is clicked on mobile', () => {
    stubMatchMedia(false)
    const onCloseAside = vi.fn()
    act(() => {
      harness.root.render(
        createElement(ContentLayout, {
          open: true,
          onCloseAside,
          children: createElement('div', null, 'main-content'),
        }),
      )
    })

    act(() => {
      findCloseButton()!.click()
    })
    expect(onCloseAside).toHaveBeenCalledTimes(1)
  })

  it('invokes onCloseAside when the scrim is clicked on mobile', () => {
    stubMatchMedia(false)
    const onCloseAside = vi.fn()
    act(() => {
      harness.root.render(
        createElement(ContentLayout, {
          open: true,
          onCloseAside,
          children: createElement('div', null, 'main-content'),
        }),
      )
    })

    act(() => {
      findScrim()!.click()
    })
    expect(onCloseAside).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onCloseAside on desktop because no close affordance exists', () => {
    stubMatchMedia(true)
    const onCloseAside = vi.fn()
    act(() => {
      harness.root.render(
        createElement(ContentLayout, {
          open: true,
          onCloseAside,
          children: createElement('div', null, 'main-content'),
        }),
      )
    })

    expect(findCloseButton()).toBeNull()
    expect(findScrim()).toBeNull()
    expect(onCloseAside).not.toHaveBeenCalled()
  })
})

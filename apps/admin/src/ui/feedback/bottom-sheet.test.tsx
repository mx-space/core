import type { ReactNode } from 'react'
import { act, createElement, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import type { BottomSheetSnap } from '~/ui/feedback/bottom-sheet'
import { BottomSheet, resolveDetent } from '~/ui/feedback/bottom-sheet'

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

function findSheet(): HTMLElement | null {
  return document.querySelector('[role="dialog"]')
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

function findToggleButton(): HTMLButtonElement | null {
  return (
    (document.querySelector(
      'button[aria-label="展开"]',
    ) as HTMLButtonElement | null) ??
    (document.querySelector(
      'button[aria-label="收起"]',
    ) as HTMLButtonElement | null)
  )
}

function render(element: ReactNode) {
  act(() => {
    harness.root.render(createElement(I18nProvider, null, element))
  })
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    render(
      createElement(BottomSheet, {
        open: false,
        onClose: vi.fn(),
        title: 'Hi',
        children: 'body',
      }),
    )
    expect(findSheet()).toBeNull()
    expect(document.body.textContent).not.toContain('body')
  })

  it('renders sheet, title and close button when open', () => {
    render(
      createElement(BottomSheet, {
        open: true,
        onClose: vi.fn(),
        title: 'My Sheet',
        children: 'body-content',
      }),
    )
    const sheet = findSheet()
    expect(sheet).not.toBeNull()
    expect(sheet!.textContent).toContain('My Sheet')
    expect(sheet!.textContent).toContain('body-content')
    expect(findCloseButton()).not.toBeNull()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      createElement(BottomSheet, {
        open: true,
        onClose,
        title: 'X',
        children: 'b',
      }),
    )
    act(() => {
      findCloseButton()!.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn()
    render(
      createElement(BottomSheet, {
        open: true,
        onClose,
        title: 'X',
        children: 'b',
      }),
    )
    act(() => {
      findScrim()!.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      createElement(BottomSheet, {
        open: true,
        onClose,
        title: 'X',
        children: 'b',
      }),
    )
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uncontrolled snap toggle switches data-snap between half and full', () => {
    render(
      createElement(BottomSheet, {
        open: true,
        onClose: vi.fn(),
        title: 'X',
        children: 'b',
      }),
    )
    expect(findSheet()!.dataset.snap).toBe('half')

    act(() => {
      findToggleButton()!.click()
    })
    expect(findSheet()!.dataset.snap).toBe('full')

    act(() => {
      findToggleButton()!.click()
    })
    expect(findSheet()!.dataset.snap).toBe('half')
  })

  it('controlled snap ignores internal state and only fires onSnapChange', () => {
    const onSnapChange = vi.fn()
    function Wrapper() {
      const [snap] = useState<BottomSheetSnap>('full')
      return createElement(BottomSheet, {
        open: true,
        onClose: vi.fn(),
        title: 'X',
        children: 'b',
        snap,
        onSnapChange,
      })
    }
    render(createElement(Wrapper))

    expect(findSheet()!.dataset.snap).toBe('full')

    act(() => {
      findToggleButton()!.click()
    })

    expect(onSnapChange).toHaveBeenCalledWith('half')
    expect(findSheet()!.dataset.snap).toBe('full')
  })
})

describe('resolveDetent', () => {
  const m = { TY_FULL: 0, TY_HALF: 300, TY_CLOSED: 800 }

  it('returns closed on strong downward fling', () => {
    expect(resolveDetent(200, 1800, 'half', m)).toBe('closed')
  })

  it('returns full on strong upward fling when not closed', () => {
    expect(resolveDetent(300, -1500, 'half', m)).toBe('full')
  })

  it('ignores strong upward fling when already closed', () => {
    // velocity-based fling shortcut should not pull a closed sheet open
    expect(resolveDetent(800, -1500, 'closed', m)).not.toBe('full')
  })

  it('projects with velocity to pick nearest detent', () => {
    // ty 200, velocity 1000 px/s, projection 0.2s → projected = 400 → closest to TY_HALF (300)
    expect(resolveDetent(200, 1000, 'half', m)).toBe('half')
  })

  it('projects upward toward full when moving up gently', () => {
    // ty 200, velocity -400 → projected 120 → closer to TY_FULL (0) than TY_HALF (300)
    expect(resolveDetent(200, -400, 'half', m)).toBe('full')
  })

  it('snaps to closed when projected near TY_CLOSED', () => {
    expect(resolveDetent(700, 200, 'half', m)).toBe('closed')
  })
})

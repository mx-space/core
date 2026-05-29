import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BottomSheetSnap } from '~/ui/feedback/bottom-sheet'
import type { Root } from 'react-dom/client'

import { BottomSheet } from '~/ui/feedback/bottom-sheet'

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
    act(() => {
      harness.root.render(
        createElement(BottomSheet, {
          open: false,
          onClose: vi.fn(),
          title: 'Hi',
          children: 'body',
        }),
      )
    })
    expect(findSheet()).toBeNull()
    expect(document.body.textContent).not.toContain('body')
  })

  it('renders sheet, title and close button when open', () => {
    act(() => {
      harness.root.render(
        createElement(BottomSheet, {
          open: true,
          onClose: vi.fn(),
          title: 'My Sheet',
          children: 'body-content',
        }),
      )
    })
    const sheet = findSheet()
    expect(sheet).not.toBeNull()
    expect(sheet!.textContent).toContain('My Sheet')
    expect(sheet!.textContent).toContain('body-content')
    expect(findCloseButton()).not.toBeNull()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    act(() => {
      harness.root.render(
        createElement(BottomSheet, {
          open: true,
          onClose,
          title: 'X',
          children: 'b',
        }),
      )
    })
    act(() => {
      findCloseButton()!.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn()
    act(() => {
      harness.root.render(
        createElement(BottomSheet, {
          open: true,
          onClose,
          title: 'X',
          children: 'b',
        }),
      )
    })
    act(() => {
      findScrim()!.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    act(() => {
      harness.root.render(
        createElement(BottomSheet, {
          open: true,
          onClose,
          title: 'X',
          children: 'b',
        }),
      )
    })
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uncontrolled snap toggle switches between half and full', () => {
    act(() => {
      harness.root.render(
        createElement(BottomSheet, {
          open: true,
          onClose: vi.fn(),
          title: 'X',
          children: 'b',
        }),
      )
    })
    const sheet = findSheet()!
    expect(sheet.style.height).toBe('60vh')

    act(() => {
      findToggleButton()!.click()
    })
    expect(findSheet()!.style.height).toBe('95vh')

    act(() => {
      findToggleButton()!.click()
    })
    expect(findSheet()!.style.height).toBe('60vh')
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
    act(() => {
      harness.root.render(createElement(Wrapper))
    })

    expect(findSheet()!.style.height).toBe('95vh')

    act(() => {
      findToggleButton()!.click()
    })

    expect(onSnapChange).toHaveBeenCalledWith('half')
    expect(findSheet()!.style.height).toBe('95vh')
  })
})

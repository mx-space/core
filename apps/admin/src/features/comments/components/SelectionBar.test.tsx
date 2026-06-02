import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { SelectionBar, type SelectionBarProps } from './SelectionBar'

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

function render(props: SelectionBarProps) {
  act(() => {
    harness.root.render(
      createElement(I18nProvider, null, createElement(SelectionBar, props)),
    )
  })
}

function q(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

function baseProps(
  overrides: Partial<SelectionBarProps> = {},
): SelectionBarProps {
  return {
    selectedCount: 12,
    isAllPageMode: false,
    totalAvailable: 238,
    onMarkRead: vi.fn(),
    onMarkJunk: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    onSelectAllAcrossPages: vi.fn(),
    canMarkRead: true,
    canMarkJunk: true,
    ...overrides,
  }
}

describe('SelectionBar', () => {
  it('shows the select-all-across-pages CTA when more items are available', () => {
    render(baseProps())
    expect(q('comments-select-across-pages')).not.toBeNull()
  })

  it('hides the CTA when already in all-page mode', () => {
    render(baseProps({ isAllPageMode: true }))
    expect(q('comments-select-across-pages')).toBeNull()
  })

  it('hides the CTA when selected count already matches total available', () => {
    render(baseProps({ selectedCount: 238, totalAvailable: 238 }))
    expect(q('comments-select-across-pages')).toBeNull()
  })

  it('hides the CTA when no onSelectAllAcrossPages handler is supplied', () => {
    render(baseProps({ onSelectAllAcrossPages: undefined }))
    expect(q('comments-select-across-pages')).toBeNull()
  })

  it('disables Mark Read when canMarkRead is false', () => {
    render(baseProps({ canMarkRead: false }))
    expect((q('comments-bulk-mark-read') as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('disables Mark Junk when canMarkJunk is false', () => {
    render(baseProps({ canMarkJunk: false }))
    expect((q('comments-bulk-mark-junk') as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('fires bulk handlers when buttons are clicked', () => {
    const onMarkRead = vi.fn()
    const onMarkJunk = vi.fn()
    const onDelete = vi.fn()
    const onClear = vi.fn()
    render(baseProps({ onMarkRead, onMarkJunk, onDelete, onClear }))

    act(() => {
      ;(q('comments-bulk-mark-read') as HTMLButtonElement).click()
    })
    act(() => {
      ;(q('comments-bulk-mark-junk') as HTMLButtonElement).click()
    })
    act(() => {
      ;(q('comments-bulk-delete') as HTMLButtonElement).click()
    })
    act(() => {
      ;(q('comments-bulk-clear') as HTMLButtonElement).click()
    })

    expect(onMarkRead).toHaveBeenCalledTimes(1)
    expect(onMarkJunk).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('fires the cross-page CTA handler', () => {
    const onSelectAllAcrossPages = vi.fn()
    render(baseProps({ onSelectAllAcrossPages }))
    act(() => {
      ;(q('comments-select-across-pages') as HTMLButtonElement).click()
    })
    expect(onSelectAllAcrossPages).toHaveBeenCalledTimes(1)
  })
})

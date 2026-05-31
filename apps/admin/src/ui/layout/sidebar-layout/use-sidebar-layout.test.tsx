import { Provider as JotaiProvider } from 'jotai'
import { act, createElement, useEffect } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '~/constants/layout'
import { jotaiStore } from '~/store/jotai-store'

import type { SidebarLayoutApi } from './use-sidebar-layout'
import { useSidebarLayout } from './use-sidebar-layout'

interface Harness {
  api: SidebarLayoutApi | null
  root: Root
  container: HTMLDivElement
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const harness: Harness = {
    api: null,
    root,
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }

  function Probe() {
    const api = useSidebarLayout()
    useEffect(() => {
      harness.api = api
    })
    harness.api = api
    return null
  }

  act(() => {
    root.render(
      createElement(JotaiProvider, { store: jotaiStore }, createElement(Probe)),
    )
  })

  return harness
}

let harness: Harness | null = null

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  harness?.unmount()
  harness = null
  localStorage.clear()
})

describe('useSidebarLayout', () => {
  it('returns defaults when storage is empty', () => {
    harness = mount()
    expect(harness.api?.collapsed).toBe(false)
    expect(harness.api?.widthPx).toBe(240)
  })

  it('clamps width above MAX on read', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, JSON.stringify(500))
    harness = mount()
    expect(harness.api?.widthPx).toBe(SIDEBAR_WIDTH_MAX)
  })

  it('clamps width below MIN on read', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, JSON.stringify(50))
    harness = mount()
    expect(harness.api?.widthPx).toBe(SIDEBAR_WIDTH_MIN)
  })

  it('falls back to default when width is non-finite', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, JSON.stringify('garbage'))
    harness = mount()
    expect(harness.api?.widthPx).toBe(240)
  })

  it('toggle flips collapsed and persists to storage', () => {
    harness = mount()
    act(() => {
      harness!.api?.toggle()
    })
    expect(harness.api?.collapsed).toBe(true)
    expect(
      JSON.parse(
        localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) || 'false',
      ),
    ).toBe(true)
    act(() => {
      harness!.api?.toggle()
    })
    expect(harness.api?.collapsed).toBe(false)
  })

  it('cmd+b toggles when focus is on body', () => {
    harness = mount()
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'b', metaKey: true }),
      )
    })
    expect(harness.api?.collapsed).toBe(true)
  })

  it('ctrl+b toggles (cross-platform)', () => {
    harness = mount()
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }),
      )
    })
    expect(harness.api?.collapsed).toBe(true)
  })

  it('does not toggle when focus is in an input', () => {
    harness = mount()
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'b', metaKey: true }),
      )
    })
    expect(harness.api?.collapsed).toBe(false)
    input.remove()
  })

  it('does not toggle when focus is in a contenteditable', () => {
    harness = mount()
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    editable.tabIndex = 0
    document.body.append(editable)
    editable.focus()
    if (document.activeElement !== editable) {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => editable,
      })
    }
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'b', metaKey: true }),
      )
    })
    expect(harness.api?.collapsed).toBe(false)
    editable.remove()
  })

  it('ignores plain b without modifier', () => {
    harness = mount()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    })
    expect(harness.api?.collapsed).toBe(false)
  })
})

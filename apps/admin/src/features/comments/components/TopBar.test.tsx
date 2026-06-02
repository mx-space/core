import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { TopBar, type TopBarProps } from './TopBar'

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

function render<K extends string>(props: TopBarProps<K>) {
  act(() => {
    harness.root.render(
      createElement(I18nProvider, null, createElement(TopBar<K>, props)),
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

const baseTabs = [
  { key: 'unread' as const, label: 'Unread', count: 42 },
  { key: 'awaiting' as const, label: 'Awaiting', count: 8 },
  { key: 'whispers' as const, label: 'Whispers', count: 0 },
  { key: 'read' as const, label: 'Read' },
  { key: 'junk' as const, label: 'Junk', count: 150 },
  { key: 'all' as const, label: 'All' },
]

type TabKey = (typeof baseTabs)[number]['key']

describe('TopBar tabs', () => {
  it('renders all tabs with appropriate count pills', () => {
    render<TabKey>({
      tabs: baseTabs,
      activeKey: 'unread',
      onSelect: vi.fn(),
      density: 'rich',
    })

    expect(q('comments-tab-unread')).not.toBeNull()
    expect(q('comments-tab-count-unread')?.textContent).toBe('42')

    // 0-count tabs render label only.
    expect(q('comments-tab-count-whispers')).toBeNull()

    // Counts > 99 render as 99+.
    expect(q('comments-tab-count-junk')?.textContent).toBe('99+')

    // Active tab is semibold + bottom border.
    const active = q('comments-tab-unread')
    expect(active?.getAttribute('aria-selected')).toBe('true')
    expect(active?.className).toContain('font-semibold')
    expect(active?.className).toContain('border-accent')
  })

  it('fires onSelect with the tab key when clicked', () => {
    const onSelect = vi.fn()
    render<TabKey>({
      tabs: baseTabs,
      activeKey: 'unread',
      onSelect,
      density: 'rich',
    })
    act(() => {
      ;(q('comments-tab-awaiting') as HTMLButtonElement).click()
    })
    expect(onSelect).toHaveBeenCalledWith('awaiting')
  })
})

describe('TopBar search', () => {
  it('expands the input when the search icon is clicked', () => {
    render<TabKey>({
      tabs: baseTabs,
      activeKey: 'unread',
      onSelect: vi.fn(),
      density: 'rich',
    })

    expect(document.querySelector('input[type="search"]')).toBeNull()
    act(() => {
      ;(q('comments-search-open') as HTMLButtonElement).click()
    })
    expect(document.querySelector('input[type="search"]')).not.toBeNull()
  })
})

describe('TopBar more menu', () => {
  it('opens the density radio group and fires onDensityChange', () => {
    const onDensityChange = vi.fn()
    render<TabKey>({
      tabs: baseTabs,
      activeKey: 'unread',
      onSelect: vi.fn(),
      density: 'rich',
      onDensityChange,
    })

    act(() => {
      ;(q('comments-topbar-menu') as HTMLButtonElement).click()
    })

    const compact = q('comments-density-compact') as HTMLButtonElement | null
    expect(compact).not.toBeNull()
    act(() => {
      compact!.click()
    })
    expect(onDensityChange).toHaveBeenCalledWith('compact')
  })

  it('fires onRefresh when refresh is chosen', () => {
    const onRefresh = vi.fn()
    render<TabKey>({
      tabs: baseTabs,
      activeKey: 'unread',
      onSelect: vi.fn(),
      density: 'rich',
      onRefresh,
    })

    act(() => {
      ;(q('comments-topbar-menu') as HTMLButtonElement).click()
    })
    const refresh = q('comments-topbar-refresh') as HTMLButtonElement | null
    expect(refresh).not.toBeNull()
    act(() => {
      refresh!.click()
    })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})

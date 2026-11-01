import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { PageHeaderBar } from '~/ui/layout/page-header-bar'

let container: HTMLDivElement
let root: Root

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

function render(element: React.ReactNode) {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(I18nProvider, null, element),
      ),
    )
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('PageHeaderBar', () => {
  it('renders title, count, filters, actions and summary', () => {
    stubMatchMedia(true)
    render(
      createElement(PageHeaderBar, {
        actions: createElement('button', { type: 'button' }, 'Clean up'),
        count: 42,
        filters: createElement('span', null, 'Filter chips'),
        summary: '12 unused · 3 history only',
        title: 'Components',
      }),
    )
    const header = container.querySelector('[data-page-header]')!
    expect(header.querySelector('h1')?.textContent).toContain('Components')
    expect(header.textContent).toContain('42')
    expect(header.textContent).toContain('Filter chips')
    expect(header.querySelector('button')?.textContent).toBe('Clean up')
    expect(header.textContent).toContain('12 unused · 3 history only')
  })
})

describe('MasterDetailShell header slot', () => {
  it('renders the header before the list on desktop', () => {
    stubMatchMedia(true)
    render(
      createElement(MasterDetailShell, {
        header: createElement(PageHeaderBar, { title: 'Drafts' }),
        list: createElement('div', { 'data-testid': 'list' }, 'list'),
      }),
    )
    const header = container.querySelector('[data-page-header]')!
    const list = container.querySelector('[data-testid="list"]')!
    expect(header).not.toBeNull()
    expect(
      header.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders the header inside the list layer on mobile', () => {
    stubMatchMedia(false)
    render(
      createElement(MasterDetailShell, {
        header: createElement(PageHeaderBar, { title: 'Drafts' }),
        list: createElement('div', { 'data-testid': 'list' }, 'list'),
      }),
    )
    const list = container.querySelector('[data-testid="list"]')!
    const header = container.querySelector('[data-page-header]')!
    const layer = header.closest('[data-page-header-slot]')
    expect(layer).not.toBeNull()
    expect(layer!.contains(list)).toBe(true)
  })

  it('adds no header wrapper without a header', () => {
    stubMatchMedia(true)
    render(
      createElement(MasterDetailShell, {
        list: createElement('div', null, 'list'),
      }),
    )
    expect(container.querySelector('[data-page-header]')).toBeNull()
    expect(container.querySelector('[data-page-header-slot]')).toBeNull()
  })
})

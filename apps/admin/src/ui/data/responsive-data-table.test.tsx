import { act, createElement, type ReactNode } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import type { ResponsiveDataTableColumn } from '~/ui/data/responsive-data-table'
import {
  DefaultRowCard,
  ResponsiveDataTable,
} from '~/ui/data/responsive-data-table'

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

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

function render(element: ReactNode) {
  act(() => {
    harness.root.render(createElement(I18nProvider, null, element))
  })
}

interface Person {
  id: string
  name: string
  email: string
  role: string
}

const people: Person[] = [
  { id: '1', name: 'Alice', email: 'a@example.com', role: 'admin' },
  { id: '2', name: 'Bob', email: 'b@example.com', role: 'user' },
]

const columns: ResponsiveDataTableColumn<Person>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'email', header: 'Email', render: (row) => row.email },
  { key: 'role', header: 'Role', render: (row) => row.role },
]

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('ResponsiveDataTable', () => {
  it('renders a table with headers on desktop', () => {
    setMatchMedia(true)
    render(
      createElement(ResponsiveDataTable<Person>, {
        rows: people,
        columns,
        rowKey: (row) => row.id,
      }),
    )
    const table = harness.container.querySelector('table')
    expect(table).not.toBeNull()
    const headers = Array.from(table!.querySelectorAll('th')).map(
      (th) => th.textContent,
    )
    expect(headers).toEqual(['Name', 'Email', 'Role'])
    expect(harness.container.textContent).toContain('Alice')
    expect(harness.container.textContent).toContain('Bob')
  })

  it('renders a stacked card list on mobile with a title per row', () => {
    setMatchMedia(false)
    render(
      createElement(ResponsiveDataTable<Person>, {
        rows: people,
        columns,
        rowKey: (row) => row.id,
      }),
    )
    expect(harness.container.querySelector('table')).toBeNull()
    const titles = Array.from(
      harness.container.querySelectorAll('div.text-sm.font-medium'),
    ).map((node) => node.textContent)
    expect(titles).toEqual(['Alice', 'Bob'])
  })

  it('uses mobileCard override when provided', () => {
    setMatchMedia(false)
    const mobileCard = vi.fn((row: Person) =>
      createElement(
        'div',
        { 'data-testid': 'custom-card' },
        `custom-${row.id}`,
      ),
    )
    render(
      createElement(ResponsiveDataTable<Person>, {
        rows: people,
        columns,
        rowKey: (row) => row.id,
        mobileCard,
      }),
    )
    expect(mobileCard).toHaveBeenCalledTimes(2)
    const cards = Array.from(
      harness.container.querySelectorAll('[data-testid="custom-card"]'),
    ).map((node) => node.textContent)
    expect(cards).toEqual(['custom-1', 'custom-2'])
    expect(harness.container.querySelector('dl')).toBeNull()
  })

  it('hides columns with hideOnMobile in DefaultRowCard', () => {
    setMatchMedia(false)
    const hiddenColumns: ResponsiveDataTableColumn<Person>[] = [
      { key: 'name', header: 'Name', render: (row) => row.name },
      {
        key: 'email',
        header: 'Email',
        render: (row) => row.email,
        hideOnMobile: true,
      },
      { key: 'role', header: 'Role', render: (row) => row.role },
    ]
    render(
      createElement(ResponsiveDataTable<Person>, {
        rows: people,
        columns: hiddenColumns,
        rowKey: (row) => row.id,
      }),
    )
    expect(harness.container.textContent).toContain('Alice')
    expect(harness.container.textContent).toContain('admin')
    expect(harness.container.textContent).not.toContain('a@example.com')
    expect(harness.container.textContent).not.toContain('Email')
  })

  it('renders empty fallback on both breakpoints', () => {
    setMatchMedia(true)
    render(
      createElement(ResponsiveDataTable<Person>, {
        rows: [],
        columns,
        rowKey: (row) => row.id,
        empty: createElement('div', { 'data-testid': 'empty' }, 'nothing'),
      }),
    )
    expect(
      harness.container.querySelector('[data-testid="empty"]'),
    ).not.toBeNull()
    expect(harness.container.querySelector('table')).toBeNull()

    setMatchMedia(false)
    render(
      createElement(ResponsiveDataTable<Person>, {
        rows: [],
        columns,
        rowKey: (row) => row.id,
        empty: createElement('div', { 'data-testid': 'empty' }, 'nothing'),
      }),
    )
    expect(
      harness.container.querySelector('[data-testid="empty"]'),
    ).not.toBeNull()
  })

  it('renders without missing-key warnings using rowKey', () => {
    setMatchMedia(false)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        createElement(ResponsiveDataTable<Person>, {
          rows: people,
          columns,
          rowKey: (row) => row.id,
        }),
      )
      const keyWarnings = errorSpy.mock.calls.filter((call) => {
        const msg = String(call[0] ?? '')
        return msg.includes('unique "key" prop')
      })
      expect(keyWarnings).toEqual([])
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('DefaultRowCard', () => {
  it('renders first column as title and remaining as label/value grid', () => {
    setMatchMedia(false)
    render(
      createElement(DefaultRowCard<Person>, {
        row: people[0],
        columns,
      }),
    )
    const title = harness.container.querySelector('div.text-sm.font-medium')
    expect(title?.textContent).toBe('Alice')
    const dts = Array.from(harness.container.querySelectorAll('dt')).map(
      (node) => node.textContent,
    )
    const dds = Array.from(harness.container.querySelectorAll('dd')).map(
      (node) => node.textContent,
    )
    expect(dts).toEqual(['Email', 'Role'])
    expect(dds).toEqual(['a@example.com', 'admin'])
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getComments,
  getCommentSourceCandidates,
  getCommentTabCounts,
} from '~/api/comments'
import { I18nProvider } from '~/i18n'
import type {
  CommentModel,
  CommentsResponse,
  CommentTab,
  CommentTabCounts,
} from '~/models/comment'
import { CommentState } from '~/models/comment'
import { KeyboardShortcutsProvider } from '~/ui/keyboard-shortcut-overlay'

import { CommentsRouteViewContent } from './CommentsRouteViewContent'

vi.mock('~/api/comments', () => ({
  batchDeleteComments: vi.fn(),
  batchUpdateCommentState: vi.fn(),
  deleteComment: vi.fn(),
  getAuthorActivity: vi.fn(),
  getCommentSourceCandidates: vi.fn(async () => ({ data: [] })),
  getCommentTabCounts: vi.fn(),
  getCommentThread: vi.fn(),
  getComments: vi.fn(),
  replyComment: vi.fn(),
  updateCommentState: vi.fn(),
}))

vi.mock('~/ui/layout/master-detail-shell', () => ({
  MasterDetailShell: (props: { list: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'shell' }, props.list),
}))

vi.mock('~/ui/layout/mobile-header-affordance', () => ({
  MobileHeaderAffordance: () => null,
}))

vi.mock('~/ui/focus-scope', async () => {
  const actual: any = await vi.importActual('~/ui/focus-scope')
  return {
    ...actual,
    FocusScope: (props: { children: React.ReactNode; className?: string }) =>
      createElement('div', { className: props.className }, props.children),
  }
})

vi.mock('~/ui/feedback/confirm', () => ({
  confirmDialog: vi.fn(async () => true),
}))

const tabCountsFixture: CommentTabCounts = {
  all: 100,
  awaiting: 8,
  junk: 3,
  read: 30,
  unread: 42,
  whispers: 2,
}

function makeComment(
  id: string,
  overrides: Partial<CommentModel> = {},
): CommentModel {
  return {
    author: `Author ${id}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    id,
    ip: '1.2.3.4',
    refType: 'post',
    state: CommentState.Unread,
    text: `Body of ${id}`,
    ...overrides,
  }
}

function listFixture(ids: string[]): CommentsResponse {
  return {
    data: ids.map((id) => makeComment(id)),
    pagination: {
      currentPage: 1,
      hasNextPage: false,
      hasPrevPage: false,
      page: 1,
      size: 20,
      total: ids.length,
      totalPages: 1,
    } as CommentsResponse['pagination'],
  }
}

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

let harness: Harness
let queryClient: QueryClient

function renderRoute(initialEntry: string) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  act(() => {
    harness.root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          I18nProvider,
          null,
          createElement(
            KeyboardShortcutsProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [initialEntry] },
              createElement(
                Routes,
                null,
                createElement(Route, {
                  element: createElement(CommentsRouteViewContent),
                  path: '/comments',
                }),
                createElement(Route, {
                  element: createElement(CommentsRouteViewContent),
                  path: '/comments/:id',
                }),
              ),
            ),
          ),
        ),
      ),
    )
  })
}

async function flush() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function waitFor(selector: () => boolean, attempts = 25) {
  for (let i = 0; i < attempts; i++) {
    if (selector()) return
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
    })
  }
}

beforeEach(() => {
  harness = mount()
  vi.mocked(getCommentTabCounts).mockResolvedValue(tabCountsFixture)
  vi.mocked(getComments).mockResolvedValue(listFixture(['c1', 'c2', 'c3']))
  vi.mocked(getCommentSourceCandidates).mockResolvedValue({ data: [] })
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function q(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
}

describe('CommentsRouteViewContent tabs', () => {
  it('renders all six tabs with counts from useCommentTabCounts', async () => {
    renderRoute('/comments?tab=unread')
    await flush()
    await waitFor(() => q('comments-tab-count-unread') != null)

    const tabs: CommentTab[] = [
      'unread',
      'awaiting',
      'whispers',
      'read',
      'junk',
      'all',
    ]
    for (const key of tabs) {
      expect(q(`comments-tab-${key}`)).not.toBeNull()
    }

    expect(q('comments-tab-count-unread')?.textContent).toBe('42')
    expect(q('comments-tab-count-awaiting')?.textContent).toBe('8')
    expect(q('comments-tab-count-junk')?.textContent).toBe('3')
    // Whispers has count 2 — pill is present.
    expect(q('comments-tab-count-whispers')?.textContent).toBe('2')
    // The "all" badge shows '99+' for any count above 99.
    expect(q('comments-tab-count-all')?.textContent).toBe('99+')

    const active = q('comments-tab-unread')
    expect(active?.getAttribute('aria-selected')).toBe('true')
  })

  it('updates the active tab when a different tab is clicked', async () => {
    renderRoute('/comments?tab=unread')
    await flush()
    await waitFor(() => q('comments-tab-awaiting') != null)
    act(() => {
      ;(q('comments-tab-awaiting') as HTMLButtonElement).click()
    })
    await flush()
    expect(q('comments-tab-awaiting')?.getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(q('comments-tab-unread')?.getAttribute('aria-selected')).toBe(
      'false',
    )
  })
})

describe('CommentsRouteViewContent filter strip / selection bar', () => {
  it('hides the SelectionBar when nothing is selected', async () => {
    renderRoute('/comments?tab=unread')
    await flush()
    expect(q('comments-selection-bar')).toBeNull()
  })

  it('replaces the FilterStrip with the SelectionBar once a row is checked', async () => {
    renderRoute('/comments?tab=unread')
    await flush()
    await waitFor(() => q('comments-row-c1') != null)

    // Find the row container and toggle its leading checkbox. Happy-dom does
    // not synthesize the checkbox change event from the visible element, so we
    // dispatch a click directly to the input the Checkbox primitive renders.
    const row = document.querySelector('[data-id="c1"]') as HTMLElement | null
    expect(row).not.toBeNull()
    const checkbox = row?.querySelector(
      'input[type="checkbox"], [role="checkbox"]',
    ) as HTMLElement | null
    if (!checkbox) {
      throw new Error('row checkbox not found')
    }
    act(() => {
      checkbox.click()
    })
    await flush()

    expect(q('comments-selection-bar')).not.toBeNull()
    expect(q('comments-filter-strip')).toBeNull()
  })
})

describe('CommentsRouteViewContent URL sync', () => {
  it('migrates legacy ?state=2 to ?tab=junk on mount', async () => {
    renderRoute('/comments?state=2')
    await flush()
    expect(q('comments-tab-junk')?.getAttribute('aria-selected')).toBe('true')
  })

  it('defaults to ?tab=unread when no tab is present', async () => {
    renderRoute('/comments')
    await flush()
    expect(q('comments-tab-unread')?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('CommentsRouteViewContent getNextOf wiring', () => {
  it('renders the row list snapshot used by getNextOf in document order', async () => {
    renderRoute('/comments?tab=unread')
    await flush()
    await waitFor(() => q('comments-row-c1') != null)
    // The orchestrator passes a getNextOf closure into buildCommentActions
    // backed by the latest list snapshot. We assert the snapshot is in the
    // expected order — the closure logic itself is unit-tested in
    // buildCommentActions.test.ts.
    const rowIds = Array.from(
      document.querySelectorAll('[data-scope-item="row"][data-id]'),
    ).map((el) => el.getAttribute('data-id'))
    expect(rowIds).toEqual(['c1', 'c2', 'c3'])
  })
})

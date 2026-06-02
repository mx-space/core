import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import type { CommentModel } from '~/models/comment'
import { CommentState } from '~/models/comment'

import { CommentListItem, type CommentListItemProps } from './CommentListItem'
import type { CommentDensity } from './TopBar'

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

const baseComment: CommentModel = {
  id: 'c1',
  createdAt: '2026-06-01T12:00:00.000Z',
  refType: 'post',
  state: CommentState.Unread,
  author: 'Alice',
  text: 'Great post — really enjoyed it.',
  mail: 'alice@example.com',
  url: 'https://alice.dev',
  ip: '1.2.3.4',
  agent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120',
  replyCount: 3,
  countryCode: 'CN',
  parent: null,
  ref: { title: 'Why I left Notion' },
}

function makeProps(
  overrides: Partial<CommentListItemProps> = {},
): CommentListItemProps {
  return {
    actions: [],
    checked: false,
    comment: baseComment,
    currentFilter: 'all',
    cursor: false,
    densityMode: 'rich',
    isDetailTarget: false,
    onCheck: vi.fn(),
    onMarkJunk: vi.fn(),
    onMarkRead: vi.fn(),
    onSelect: vi.fn(),
    onSourceFilter: vi.fn(),
    selected: false,
    ...overrides,
  }
}

function render(props: CommentListItemProps) {
  act(() => {
    harness.root.render(
      createElement(I18nProvider, null, createElement(CommentListItem, props)),
    )
  })
}

let harness: Harness

beforeEach(() => {
  harness = mount()
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

function q(id: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
}

describe('CommentListItem density matrix', () => {
  const cases: Array<{
    mode: CommentDensity
    identity: boolean
    parent: boolean
    bodyClamp: 'line-clamp-1' | 'line-clamp-2'
    ip: boolean
    ua: boolean
    thread: boolean
  }> = [
    {
      mode: 'compact',
      identity: false,
      parent: false,
      bodyClamp: 'line-clamp-1',
      ip: false,
      ua: false,
      thread: false,
    },
    {
      mode: 'cozy',
      identity: false,
      parent: true,
      bodyClamp: 'line-clamp-2',
      ip: false,
      ua: false,
      thread: true,
    },
    {
      mode: 'rich',
      identity: true,
      parent: true,
      bodyClamp: 'line-clamp-2',
      ip: true,
      ua: true,
      thread: true,
    },
  ]

  for (const c of cases) {
    it(`renders R3 visibility matrix at density=${c.mode}`, () => {
      render(
        makeProps({
          densityMode: c.mode,
          comment: {
            ...baseComment,
            parent: {
              id: 'p1',
              author: 'Bob',
              text: 'Thanks for sharing this perspective on the matter',
              isDeleted: false,
            },
          },
        }),
      )

      expect(Boolean(q('comments-row-identity'))).toBe(c.identity)
      expect(Boolean(q('comments-row-parent-quote'))).toBe(c.parent)
      expect(q('comments-row-body')?.className).toContain(c.bodyClamp)
      expect(Boolean(q('comments-row-ip'))).toBe(c.ip)
      expect(Boolean(q('comments-row-ua'))).toBe(c.ua)
      expect(Boolean(q('comments-row-thread'))).toBe(c.thread)
      // Country flag is always shown.
      expect(q('comments-row-country')).not.toBeNull()
    })
  }
})

describe('CommentListItem identity precedence', () => {
  it('uses mail when present', () => {
    render(makeProps())
    expect(q('comments-row-identity')?.textContent).toBe('alice@example.com')
  })

  it('falls back to url when mail is missing', () => {
    render(
      makeProps({
        comment: { ...baseComment, mail: undefined },
      }),
    )
    expect(q('comments-row-identity')?.textContent).toBe('https://alice.dev')
  })

  it('falls back to anonymous when both mail and url are missing', () => {
    render(
      makeProps({
        comment: { ...baseComment, mail: undefined, url: undefined },
      }),
    )
    expect(q('comments-row-identity')?.textContent).toMatch(/anonymous|匿名/)
  })
})

describe('CommentListItem badges', () => {
  it('renders edited badge when editedAt is present', () => {
    render(
      makeProps({
        comment: { ...baseComment, editedAt: '2026-06-01T13:00:00.000Z' },
      }),
    )
    expect(q('comments-row-badge-edited')).not.toBeNull()
  })

  it('renders whispers badge when isWhispers is true', () => {
    render(
      makeProps({
        comment: { ...baseComment, isWhispers: true },
      }),
    )
    expect(q('comments-row-badge-whispers')).not.toBeNull()
  })

  it('renders junk badge only when current filter is Junk', () => {
    render(makeProps({ currentFilter: CommentState.Junk }))
    expect(q('comments-row-badge-junk')).not.toBeNull()

    harness.unmount()
    harness = mount()
    render(makeProps({ currentFilter: 'all' }))
    expect(q('comments-row-badge-junk')).toBeNull()
  })

  it('renders pinned badge when comment.pin is true', () => {
    render(makeProps({ comment: { ...baseComment, pin: true } }))
    expect(q('comments-row-badge-pinned')).not.toBeNull()
  })

  it('renders owner-reply badge only when parent author equals ownerName', () => {
    render(
      makeProps({
        ownerName: 'Innei',
        comment: {
          ...baseComment,
          parent: {
            id: 'p1',
            author: 'Innei',
            text: 'a reply',
            isDeleted: false,
          },
        },
      }),
    )
    expect(q('comments-row-badge-owner')).not.toBeNull()

    harness.unmount()
    harness = mount()
    render(
      makeProps({
        ownerName: 'Innei',
        comment: {
          ...baseComment,
          parent: {
            id: 'p1',
            author: 'Someone',
            text: 'a reply',
            isDeleted: false,
          },
        },
      }),
    )
    expect(q('comments-row-badge-owner')).toBeNull()
  })

  it('hides parent quote when parent is soft-deleted', () => {
    render(
      makeProps({
        densityMode: 'cozy',
        comment: {
          ...baseComment,
          parent: {
            id: 'p1',
            author: 'Bob',
            text: 'deleted',
            isDeleted: true,
          },
        },
      }),
    )
    expect(q('comments-row-parent-quote')).toBeNull()
  })
})

describe('CommentListItem source chip', () => {
  it('invokes onSourceFilter and stops row selection when clicked', () => {
    const onSourceFilter = vi.fn()
    const onSelect = vi.fn()
    render(makeProps({ onSourceFilter, onSelect }))

    const chip = q('comments-row-source') as HTMLButtonElement | null
    expect(chip).not.toBeNull()
    act(() => {
      chip!.click()
    })
    expect(onSourceFilter).toHaveBeenCalledTimes(1)
    expect(onSourceFilter.mock.calls[0][0].id).toBe(baseComment.id)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

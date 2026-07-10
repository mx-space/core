import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import type {
  CommentAuthorActivity,
  CommentModel,
  CommentThreadResponse,
} from '~/models/comment'
import { CommentState } from '~/models/comment'

import { CommentDetail } from './CommentDetail'

vi.mock('~/api/options', () => ({
  getOwner: vi.fn(() => new Promise(() => {})),
}))

vi.mock('~/ui/primitives/markdown-render', () => ({
  MarkdownRender: ({ text }: { text: string }) => text,
}))

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

const parent: CommentModel = {
  id: '1',
  createdAt: '2026-01-01T00:00:00Z',
  refType: 'post',
  state: CommentState.Unread,
  author: 'Bob',
  text: 'parent body content here',
}

const current: CommentModel = {
  id: '2',
  createdAt: '2026-01-02T00:00:00Z',
  refType: 'post',
  state: CommentState.Unread,
  author: 'Alice',
  mail: 'alice@example.com',
  text: 'spotlight body about second-order effects',
  parentCommentId: '1',
  ip: '1.2.3.4',
  countryCode: 'CN',
}

function makeSiblings(count: number): CommentModel[] {
  return Array.from({ length: count }).map((_, idx) => ({
    id: `s-${idx}`,
    createdAt: new Date(2026, 0, 10 + idx).toISOString(),
    refType: 'post' as const,
    state: CommentState.Unread,
    author: `Person${idx}`,
    text: `sibling body number ${idx}`,
    parentCommentId: '1',
  }))
}

const activity: CommentAuthorActivity = {
  totalCount: 7,
  firstSeenAt: '2025-12-01T00:00:00Z',
  lastSeenAt: '2026-01-02T00:00:00Z',
  items: [
    {
      id: '2',
      createdAt: current.createdAt,
      refType: 'post',
      refTitle: 'Why I left Notion',
      textExcerpt: 'spotlight body',
      state: CommentState.Unread,
    },
    {
      id: 'a-1',
      createdAt: '2025-12-15T00:00:00Z',
      refType: 'post',
      refTitle: 'Some other post',
      textExcerpt: 'earlier comment',
      state: CommentState.Read,
    },
  ],
  threatLevel: 'trusted',
  threatReason: '30d clean',
}

function makeThread(siblings: CommentModel[]): CommentThreadResponse {
  return {
    currentCommentId: current.id,
    rootCommentId: parent.id,
    root: parent,
    thread: [parent, current, ...siblings],
    current,
    ref: null,
  }
}

function renderDetail(
  harness: Harness,
  overrides: Partial<Parameters<typeof CommentDetail>[0]> = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  act(() => {
    harness.root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          null,
          createElement(
            I18nProvider,
            null,
            createElement(CommentDetail, {
              comment: current,
              onBack: vi.fn(),
              onDelete: vi.fn(),
              onReply: vi.fn(async () => current),
              onStateChange: vi.fn(),
              replyPending: false,
              thread: makeThread(makeSiblings(5)),
              activity,
              ...overrides,
            }),
          ),
        ),
      ),
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

describe('CommentDetail', () => {
  it('renders parent quote and sidebar contents', () => {
    renderDetail(harness)
    const text = harness.container.textContent ?? ''
    expect(text).toContain('parent body content here')
    expect(text).toContain('Alice')
    expect(text).toContain('alice@example.com')
    expect(text).toContain('1.2.3.4')
  })

  it('renders every thread message in chronological order without folding', () => {
    renderDetail(harness)
    const text = harness.container.textContent ?? ''
    for (let i = 0; i < 5; i++) {
      expect(text).toContain(`sibling body number ${i}`)
    }
    const currentMarker = harness.container.querySelector(
      '[data-testid="comments-thread-current"]',
    )
    expect(currentMarker).not.toBeNull()
  })

  it('renders the threat reason from activity', () => {
    renderDetail(harness)
    expect(harness.container.textContent ?? '').toContain('30d clean')
  })

  it('renders a reply once when the thread refreshes before the reply mutation resolves', async () => {
    const persistedReply: CommentModel = {
      id: 'reply-1',
      createdAt: '2026-01-03T00:00:00Z',
      refType: 'post',
      state: CommentState.Read,
      author: 'Owner',
      parentCommentId: current.id,
      rootCommentId: parent.id,
      text: 'a reply that must appear once',
    }

    function ReplyReconciliationHarness() {
      const [thread, setThread] = useState(makeThread([]))

      return createElement(CommentDetail, {
        activity,
        comment: current,
        onBack: vi.fn(),
        onDelete: vi.fn(),
        onReply: async () => {
          setThread((previous) => ({
            ...previous,
            thread: [...previous.thread, persistedReply],
          }))
          return persistedReply
        },
        onStateChange: vi.fn(),
        replyPending: false,
        thread,
      })
    }

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(
            MemoryRouter,
            null,
            createElement(
              I18nProvider,
              null,
              createElement(ReplyReconciliationHarness),
            ),
          ),
        ),
      )
    })

    const textarea = harness.container.querySelector('textarea')
    if (!textarea) throw new Error('reply textarea missing')
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
    act(() => {
      setter?.call(textarea, persistedReply.text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const form = textarea.closest('form')
    if (!form) throw new Error('reply form missing')
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })

    const matchingMessages = Array.from(
      harness.container.querySelectorAll(
        '[data-testid="comments-thread-message"]',
      ),
    ).filter((message) => message.textContent?.includes(persistedReply.text))
    expect(matchingMessages).toHaveLength(1)
  })

  it('does not render a late reply after navigating to another comment', async () => {
    const nextComment: CommentModel = {
      id: 'next-comment',
      createdAt: '2026-01-04T00:00:00Z',
      refType: 'post',
      state: CommentState.Read,
      author: 'Carol',
      rootCommentId: null,
      text: 'the next thread',
    }
    const nextThread: CommentThreadResponse = {
      currentCommentId: nextComment.id,
      rootCommentId: nextComment.id,
      root: nextComment,
      thread: [nextComment],
      current: nextComment,
      ref: null,
    }
    const lateReply: CommentModel = {
      id: 'late-reply',
      createdAt: '2026-01-03T00:00:00Z',
      refType: 'post',
      state: CommentState.Read,
      author: 'Owner',
      parentCommentId: current.id,
      rootCommentId: parent.id,
      text: 'a late reply from the first thread',
    }
    let resolveReply!: (reply: CommentModel) => void
    const replyPromise = new Promise<CommentModel>((resolve) => {
      resolveReply = resolve
    })

    function ReplyNavigationHarness() {
      const [showNextComment, setShowNextComment] = useState(false)
      const comment = showNextComment ? nextComment : current
      const thread = showNextComment ? nextThread : makeThread([])

      return createElement(
        'div',
        null,
        createElement(
          'button',
          {
            'data-testid': 'switch-comment',
            onClick: () => setShowNextComment(true),
            type: 'button',
          },
          'Switch comment',
        ),
        createElement(CommentDetail, {
          activity,
          comment,
          onBack: vi.fn(),
          onDelete: vi.fn(),
          onReply: () => replyPromise,
          onStateChange: vi.fn(),
          replyPending: false,
          thread,
        }),
      )
    }

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    act(() => {
      harness.root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(
            MemoryRouter,
            null,
            createElement(
              I18nProvider,
              null,
              createElement(ReplyNavigationHarness),
            ),
          ),
        ),
      )
    })

    const textarea = harness.container.querySelector('textarea')
    if (!textarea) throw new Error('reply textarea missing')
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
    act(() => {
      setter?.call(textarea, lateReply.text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const form = textarea.closest('form')
    if (!form) throw new Error('reply form missing')
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })

    const switchComment = harness.container.querySelector(
      '[data-testid="switch-comment"]',
    )
    if (!switchComment) throw new Error('switch button missing')
    act(() => {
      switchComment.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      resolveReply(lateReply)
      await Promise.resolve()
    })

    expect(harness.container.textContent).not.toContain(lateReply.text)
  })
})

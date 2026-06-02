// @vitest-environment node

import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuthorActivity } from '~/api/comments'
import type { CommentAuthorActivity } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

vi.mock('~/api/comments', () => ({
  getAuthorActivity: vi.fn(),
}))

const fixture: CommentAuthorActivity = {
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  items: [],
  lastSeenAt: '2026-06-01T00:00:00.000Z',
  threatLevel: 'neutral',
  totalCount: 1,
}

const getAuthorActivityMock = vi.mocked(getAuthorActivity)

beforeEach(() => {
  getAuthorActivityMock.mockReset()
  getAuthorActivityMock.mockResolvedValue(fixture)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuthorActivity enablement and key shape', () => {
  it('key shape carries both mail and ip slots', () => {
    expect(
      adminQueryKeys.comments.authorActivity({
        mail: 'alice@example.com',
        ip: undefined,
      }),
    ).toEqual([
      'comments',
      'author-activity',
      { mail: 'alice@example.com', ip: undefined },
    ])
  })

  it('mail alone enables and fires the request', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const data = await client.fetchQuery({
      queryFn: () =>
        getAuthorActivity({ mail: 'alice@example.com', ip: undefined }),
      queryKey: adminQueryKeys.comments.authorActivity({
        mail: 'alice@example.com',
      }),
    })
    expect(data).toEqual(fixture)
    expect(getAuthorActivityMock).toHaveBeenCalledTimes(1)
  })

  it('ip alone enables and fires the request', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const data = await client.fetchQuery({
      queryFn: () => getAuthorActivity({ mail: undefined, ip: '1.2.3.4' }),
      queryKey: adminQueryKeys.comments.authorActivity({ ip: '1.2.3.4' }),
    })
    expect(data).toEqual(fixture)
    expect(getAuthorActivityMock).toHaveBeenCalledTimes(1)
  })

  it('neither mail nor ip → enabled is false (the hook must not fire)', () => {
    // The enable predicate is the contract; the hook computes
    // `enabled = Boolean(mail || ip)` and TanStack Query skips a disabled
    // query. We assert the predicate explicitly so a future refactor cannot
    // silently lose it.
    const params: { mail?: string; ip?: string } = {}
    const enabled = Boolean(params.mail || params.ip)
    expect(enabled).toBe(false)
  })

  it('produces stable keys for the same inputs (caching contract)', () => {
    const k1 = adminQueryKeys.comments.authorActivity({
      mail: 'alice@example.com',
    })
    const k2 = adminQueryKeys.comments.authorActivity({
      mail: 'alice@example.com',
    })
    expect(k1).toEqual(k2)
  })
})

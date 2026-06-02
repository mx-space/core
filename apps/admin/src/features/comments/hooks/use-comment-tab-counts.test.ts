// @vitest-environment node

import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCommentTabCounts } from '~/api/comments'
import type { CommentTabCounts } from '~/models/comment'
import { adminQueryKeys } from '~/query/keys'

vi.mock('~/api/comments', () => ({
  getCommentTabCounts: vi.fn(),
}))

const fixture: CommentTabCounts = {
  all: 5,
  awaiting: 2,
  junk: 1,
  read: 3,
  unread: 2,
  whispers: 0,
}

const getCommentTabCountsMock = vi.mocked(getCommentTabCounts)

beforeEach(() => {
  getCommentTabCountsMock.mockReset()
  getCommentTabCountsMock.mockResolvedValue(fixture)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCommentTabCounts query contract', () => {
  it('uses the documented query key shape (no refType/refId)', () => {
    expect(adminQueryKeys.comments.tabCounts({})).toEqual([
      'comments',
      'tab-counts',
      { refId: undefined, refType: undefined },
    ])
  })

  it('threads refType + refId through the query key', () => {
    expect(
      adminQueryKeys.comments.tabCounts({ refType: 'post', refId: 'abc' }),
    ).toEqual(['comments', 'tab-counts', { refType: 'post', refId: 'abc' }])
  })

  it('fetches counts and caches them with a 30s stale window', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const queryKey = adminQueryKeys.comments.tabCounts({})

    const data = await client.fetchQuery({
      queryFn: () => getCommentTabCounts({}),
      queryKey,
      staleTime: 30_000,
    })
    expect(data).toEqual(fixture)
    expect(getCommentTabCountsMock).toHaveBeenCalledTimes(1)

    // The cached entry is still fresh — re-fetching within the stale window
    // must reuse the cache, not call the API again.
    await client.fetchQuery({
      queryFn: () => getCommentTabCounts({}),
      queryKey,
      staleTime: 30_000,
    })
    expect(getCommentTabCountsMock).toHaveBeenCalledTimes(1)
  })

  it('invalidation forces a re-fetch on the same key', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const queryKey = adminQueryKeys.comments.tabCounts({})

    await client.fetchQuery({
      queryFn: () => getCommentTabCounts({}),
      queryKey,
      staleTime: 30_000,
    })
    expect(getCommentTabCountsMock).toHaveBeenCalledTimes(1)

    await client.invalidateQueries({ queryKey })
    await client.fetchQuery({
      queryFn: () => getCommentTabCounts({}),
      queryKey,
      staleTime: 30_000,
    })
    expect(getCommentTabCountsMock).toHaveBeenCalledTimes(2)
  })
})

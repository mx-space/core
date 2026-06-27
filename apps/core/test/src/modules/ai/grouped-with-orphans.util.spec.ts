import { describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { buildGroupedWithOrphans } from '~/modules/ai/grouped-with-orphans.util'

type FakeItem = { id: string; refId: string }

const ARTICLE_MAP_REPLY = {
  posts: [
    { id: 'post-9', title: 'P9' },
    { id: 'post-7', title: 'P7' },
    { id: 'post-5', title: 'P5' },
    { id: 'post-3', title: 'P3' },
    { id: 'post-1', title: 'P1' },
  ],
  notes: [{ id: 'note-2', title: 'N2' }],
}

const buildHarness = (
  recordsPageData: Array<{ refId: string }>,
  recordsTotal: number,
  distinctRefIds: string[],
) => {
  const items: FakeItem[] = recordsPageData.map((row, i) => ({
    id: `item-${i}`,
    refId: row.refId,
  }))
  const databaseService = {
    findArticleIdsByTitle: vi.fn().mockResolvedValue([]),
    getRefArticleMap: vi.fn(async (refIds: string[]) =>
      Object.fromEntries(
        refIds
          .map((id) => {
            const article =
              ARTICLE_MAP_REPLY.posts.find((p) => p.id === id) ??
              ARTICLE_MAP_REPLY.notes.find((n) => n.id === id)
            if (!article) return null
            const type = id.startsWith('post-')
              ? CollectionRefTypes.Post
              : CollectionRefTypes.Note
            return [id, { id, title: article.title, type }]
          })
          .filter((entry): entry is [string, any] => entry !== null),
      ),
    ),
  }
  return {
    databaseService,
    fetchCandidateArticles: vi.fn(async () => ARTICLE_MAP_REPLY),
    fetchRecordsPage: vi.fn(async () => ({
      data: recordsPageData,
      pagination: {
        total: recordsTotal,
        currentPage: 1,
        totalPage: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })),
    fetchRecordsDistinctRefIds: vi.fn(async () => distinctRefIds),
    fetchItemsByRefIds: vi.fn(async (refIds: string[]) =>
      items.filter((item) => refIds.includes(item.refId)),
    ),
    getItemRefId: (item: FakeItem) => item.refId,
  }
}

describe('buildGroupedWithOrphans', () => {
  it('orders records-having groups first, then orphans by id desc', async () => {
    const harness = buildHarness(
      [{ refId: 'post-3' }, { refId: 'post-1' }],
      2,
      ['post-3', 'post-1'],
    )

    const result = await buildGroupedWithOrphans({
      page: 1,
      size: 10,
      databaseService: harness.databaseService as any,
      fetchCandidateArticles: harness.fetchCandidateArticles,
      fetchRecordsPage: harness.fetchRecordsPage,
      fetchRecordsDistinctRefIds: harness.fetchRecordsDistinctRefIds,
      fetchItemsByRefIds: harness.fetchItemsByRefIds,
      getItemRefId: harness.getItemRefId,
    })

    expect(result.pagination.total).toBe(6)
    expect(result.data.map((row) => row.article.id)).toEqual([
      'post-3',
      'post-1',
      'post-9',
      'post-7',
      'post-5',
      'note-2',
    ])
    expect(result.data[0].items.length).toBe(1)
    expect(result.data[2].items).toEqual([])
  })

  it('fills the trailing space on a partial records page with orphans', async () => {
    const harness = buildHarness(
      [{ refId: 'post-3' }, { refId: 'post-1' }],
      2,
      ['post-3', 'post-1'],
    )

    const result = await buildGroupedWithOrphans({
      page: 1,
      size: 3,
      databaseService: harness.databaseService as any,
      fetchCandidateArticles: harness.fetchCandidateArticles,
      fetchRecordsPage: harness.fetchRecordsPage,
      fetchRecordsDistinctRefIds: harness.fetchRecordsDistinctRefIds,
      fetchItemsByRefIds: harness.fetchItemsByRefIds,
      getItemRefId: harness.getItemRefId,
    })

    expect(result.data.map((r) => r.article.id)).toEqual([
      'post-3',
      'post-1',
      'post-9',
    ])
    expect(result.pagination.total).toBe(6)
  })

  it('returns pure-orphan slice when offset is past records-having total', async () => {
    const harness = buildHarness([], 2, ['post-3', 'post-1'])

    const result = await buildGroupedWithOrphans({
      page: 3,
      size: 2,
      databaseService: harness.databaseService as any,
      fetchCandidateArticles: harness.fetchCandidateArticles,
      fetchRecordsPage: harness.fetchRecordsPage,
      fetchRecordsDistinctRefIds: harness.fetchRecordsDistinctRefIds,
      fetchItemsByRefIds: harness.fetchItemsByRefIds,
      getItemRefId: harness.getItemRefId,
    })

    expect(result.data.map((r) => r.article.id)).toEqual(['post-5', 'note-2'])
    expect(result.pagination.total).toBe(6)
    expect(harness.fetchItemsByRefIds).not.toHaveBeenCalled()
  })

  it('returns an empty list immediately when search yields zero matches', async () => {
    const harness = buildHarness([], 0, [])
    harness.databaseService.findArticleIdsByTitle.mockResolvedValue([])

    const result = await buildGroupedWithOrphans({
      page: 1,
      size: 10,
      search: 'nothing',
      databaseService: harness.databaseService as any,
      fetchCandidateArticles: harness.fetchCandidateArticles,
      fetchRecordsPage: harness.fetchRecordsPage,
      fetchRecordsDistinctRefIds: harness.fetchRecordsDistinctRefIds,
      fetchItemsByRefIds: harness.fetchItemsByRefIds,
      getItemRefId: harness.getItemRefId,
    })

    expect(result).toEqual({
      data: [],
      pagination: expect.objectContaining({ total: 0 }),
    })
    expect(harness.fetchRecordsPage).not.toHaveBeenCalled()
    expect(harness.fetchCandidateArticles).not.toHaveBeenCalled()
  })

  it('filters orphans by searchable refIds when search matches', async () => {
    const harness = buildHarness([{ refId: 'post-1' }], 1, ['post-1'])
    harness.databaseService.findArticleIdsByTitle.mockResolvedValue([
      'post-1',
      'post-9',
    ])

    const result = await buildGroupedWithOrphans({
      page: 1,
      size: 10,
      search: 'post',
      databaseService: harness.databaseService as any,
      fetchCandidateArticles: harness.fetchCandidateArticles,
      fetchRecordsPage: harness.fetchRecordsPage,
      fetchRecordsDistinctRefIds: harness.fetchRecordsDistinctRefIds,
      fetchItemsByRefIds: harness.fetchItemsByRefIds,
      getItemRefId: harness.getItemRefId,
    })

    expect(result.data.map((r) => r.article.id)).toEqual(['post-1', 'post-9'])
    expect(harness.fetchRecordsPage).toHaveBeenCalledWith(1, 10, [
      'post-1',
      'post-9',
    ])
    expect(harness.fetchRecordsDistinctRefIds).toHaveBeenCalledWith([
      'post-1',
      'post-9',
    ])
  })
})

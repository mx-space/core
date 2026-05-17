import { describe, expect, it, vi } from 'vitest'

import { PostRepository } from '~/modules/post/post.repository'
import type { EntityId } from '~/shared/id/entity-id'
import { ContentFormat } from '~/shared/types/content-format.type'

function createThenableQuery<T>(result: T) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: (
      onFulfilled?: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    where: vi.fn(() => query),
  }
  return query
}

const postRow = (index: number, categoryId: EntityId) => ({
  id: `${1000 + index}`,
  categoryId,
  content: null,
  contentFormat: ContentFormat.Markdown,
  copyright: true,
  createdAt: new Date(`2026-01-${String(index).padStart(2, '0')}T00:00:00Z`),
  images: null,
  isPublished: true,
  likeCount: 0,
  meta: null,
  modifiedAt: null,
  pinAt: null,
  pinOrder: null,
  readCount: 0,
  slug: `post-${index}`,
  summary: null,
  tags: [],
  text: `Post ${index}`,
  title: `Post ${index}`,
})

describe('PostRepository', () => {
  it('hydrates categories in one batched query when listing posts', async () => {
    const category1 = '2001' as EntityId
    const category2 = '2002' as EntityId
    const rows = Array.from({ length: 10 }, (_, index) =>
      postRow(index + 1, index % 2 === 0 ? category1 : category2),
    )
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(createThenableQuery(rows))
        .mockReturnValueOnce(createThenableQuery([{ count: 10 }]))
        .mockReturnValueOnce(
          createThenableQuery([
            {
              id: category1,
              name: 'Category 1',
              slug: 'category-1',
              type: 0,
            },
            {
              id: category2,
              name: 'Category 2',
              slug: 'category-2',
              type: 0,
            },
          ]),
        )
        .mockReturnValueOnce(createThenableQuery([])),
    }
    const repository = new PostRepository(db as any, {} as any)

    const result = await repository.list({
      page: 1,
      publishedOnly: true,
      size: 10,
    })

    expect(db.select).toHaveBeenCalledTimes(4)
    expect(result.data).toHaveLength(10)
    expect(result.data.every((row) => row.category?.slug)).toBe(true)
    expect(result.data[0].category?.slug).toBe('category-1')
    expect(result.data[1].category?.slug).toBe('category-2')
  })
})

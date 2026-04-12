import { describe, expect, it, vi } from 'vitest'

import { AggregateService } from '~/modules/aggregate/aggregate.service'

describe('AggregateService canonical id handling', () => {
  it('returns top articles with canonical ids from lean posts', async () => {
    const lean = vi.fn().mockResolvedValue([
      {
        id: 'post-1',
        title: 'Canonical ID',
        slug: 'canonical-id',
        count: { read: 42, like: 7 },
        categoryId: {
          name: 'Frontend',
          slug: 'frontend',
        },
      },
    ])
    const populate = vi.fn().mockReturnValue({ lean })
    const select = vi.fn().mockReturnValue({ populate })
    const limit = vi.fn().mockReturnValue({ select })
    const sort = vi.fn().mockReturnValue({ limit })
    const find = vi.fn().mockReturnValue({ sort })

    const service = new AggregateService(
      { model: { find } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const result = await service.getTopArticles()

    expect(find).toHaveBeenCalledWith({ isPublished: true })
    expect(result).toEqual([
      {
        id: 'post-1',
        title: 'Canonical ID',
        slug: 'canonical-id',
        reads: 42,
        likes: 7,
        category: {
          name: 'Frontend',
          slug: 'frontend',
        },
      },
    ])
    expect(result[0]).not.toHaveProperty('_id')
  })
})

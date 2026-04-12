import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CategoryService } from '~/modules/category/category.service'

describe('CategoryService canonical id handling', () => {
  let service: CategoryService
  let categoryModel: any
  let postService: any

  beforeEach(() => {
    categoryModel = {
      countDocuments: vi.fn().mockResolvedValue(1),
      create: vi.fn(),
      find: vi.fn(),
    }
    postService = {
      model: {
        countDocuments: vi.fn(),
        find: vi.fn(),
      },
    }

    service = new CategoryService(
      categoryModel,
      { emit: vi.fn() } as any,
      {} as any,
      { get: vi.fn().mockReturnValue(postService) } as any,
    )
    ;(service as any).postService = postService
  })

  it('counts category posts by canonical id on lean results', async () => {
    categoryModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Frontend' }]),
    })
    postService.model.countDocuments.mockResolvedValue(3)

    const result = await service.findAllCategory()

    expect(postService.model.countDocuments).toHaveBeenCalledWith({
      categoryId: 'cat-1',
    })
    expect(result).toEqual([
      {
        id: 'cat-1',
        name: 'Frontend',
        count: 3,
      },
    ])
  })

  it('returns tag article payloads with id instead of _id', async () => {
    const created = new Date('2026-03-14T00:00:00.000Z')
    const modified = new Date('2026-03-15T00:00:00.000Z')
    postService.model.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([
        {
          id: 'post-1',
          title: 'Canonical ID',
          slug: 'canonical-id',
          category: {
            id: 'cat-1',
            name: 'Frontend',
            count: 9,
            __v: 0,
            created,
            modified,
          },
          created,
          modified,
        },
      ]),
    })

    const result = await service.findArticleWithTag('frontend')

    expect(result).toEqual([
      {
        id: 'post-1',
        title: 'Canonical ID',
        slug: 'canonical-id',
        category: {
          id: 'cat-1',
          name: 'Frontend',
        },
        created,
        modified,
      },
    ])
    expect(result[0]).not.toHaveProperty('_id')
  })
})

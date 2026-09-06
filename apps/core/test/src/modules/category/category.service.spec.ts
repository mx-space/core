import { describe, expect, it, vi } from 'vitest'

import { CategoryService } from '~/modules/category/category.service'

describe('CategoryService deletion', () => {
  it.each([0, 1])(
    'only deletes a category when its article count is zero (count=%i)',
    async (count) => {
      const repository = {
        countAll: vi.fn().mockResolvedValue(1),
        findById: vi.fn().mockResolvedValue({ id: 'category-1' }),
        deleteById: vi.fn().mockResolvedValue(true),
      }
      const posts = { countByCategoryId: vi.fn().mockResolvedValue(count) }
      const service = new CategoryService(
        repository as any,
        { emit: vi.fn() } as any,
        {} as any,
        { get: () => posts } as any,
      )
      service.onApplicationBootstrap()
      if (count) {
        await expect(service.deleteById('category-1')).rejects.toThrow()
        expect(repository.deleteById).not.toHaveBeenCalled()
      } else {
        await expect(service.deleteById('category-1')).resolves.toEqual({
          deletedCount: 1,
        })
        expect(repository.deleteById).toHaveBeenCalledWith('category-1')
      }
      expect(posts.countByCategoryId).toHaveBeenCalledWith('category-1')
    },
  )
})

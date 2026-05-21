import { describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/response/error.types'
import { PostController } from '~/modules/post/post.controller'

const createController = () => {
  const postService = {
    findBySlug: vi.fn().mockResolvedValue({
      id: 'post-1',
      slug: 'hello',
      category: { slug: 'default' },
    }),
    findById: vi.fn().mockResolvedValue({ id: 'post-1', isPublished: true }),
    create: vi.fn().mockResolvedValue({ id: 'post-1' }),
    updateById: vi.fn().mockResolvedValue({ id: 'post-1' }),
    deletePost: vi.fn(),
  }
  const controller = new PostController(
    postService as any,
    {} as any,
    {} as any,
    {} as any,
  )
  return { controller, postService }
}

describe('PostController', () => {
  it('builds public URLs from PG post and category rows', async () => {
    const { controller } = createController()

    await expect(controller.getBySlug('hello')).resolves.toEqual({
      path: '/default/hello',
    })
  })

  it('hides unpublished posts from anonymous detail requests', async () => {
    const { controller, postService } = createController()
    postService.findById.mockResolvedValue({ id: 'post-1', isPublished: false })

    await expect(controller.getById({ id: 'post-1' }, false)).rejects.toThrow(
      AppException,
    )
  })

  it('delegates publish status changes to PostService updateById', async () => {
    const { controller, postService } = createController()

    await expect(
      controller.setPublishStatus({ id: 'post-1' }, {
        isPublished: false,
      } as any),
    ).resolves.toEqual({ success: true })

    expect(postService.updateById).toHaveBeenCalledWith('post-1', {
      isPublished: false,
    })
  })
})

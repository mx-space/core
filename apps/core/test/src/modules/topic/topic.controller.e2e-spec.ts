import { describe, expect, it, vi } from 'vitest'

import { TopicBaseController } from '~/modules/topic/topic.controller'
import { TopicNotFoundException } from '~/modules/topic/topic.exceptions'

const createController = () => {
  const repository = {
    findAll: vi.fn().mockResolvedValue([{ id: 'topic-1' }]),
    findBySlug: vi.fn().mockResolvedValue({ id: 'topic-1', slug: 'hello' }),
    findById: vi.fn().mockResolvedValue({ id: 'topic-1' }),
  }
  return {
    controller: new TopicBaseController(repository as any),
    repository,
  }
}

describe('TopicBaseController', () => {
  it('normalizes topic slugs before repository lookup', async () => {
    const { controller, repository } = createController()

    await expect(
      controller.getTopicByTopic({ slug: 'Hello Topic' } as any),
    ).resolves.toEqual({ data: { id: 'topic-1', slug: 'hello' } })

    expect(repository.findBySlug).toHaveBeenCalledWith('Hello-Topic')
  })

  it('throws when the PG repository cannot resolve the topic slug', async () => {
    const { controller, repository } = createController()
    repository.findBySlug.mockResolvedValue(null)

    await expect(
      controller.getTopicByTopic({ slug: 'missing' } as any),
    ).rejects.toThrow(TopicNotFoundException)
  })
})

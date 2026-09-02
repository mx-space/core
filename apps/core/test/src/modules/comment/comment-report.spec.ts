import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { CommentService } from '~/modules/comment/comment.service'

describe('CommentService.reportComment', () => {
  const redisStore = new Map<string, string>()
  const redisClient = {
    set: async (key: string, value: string, ...rest: unknown[]) => {
      if (rest.includes('NX') && redisStore.has(key)) return null
      redisStore.set(key, value)
      return 'OK'
    },
  }
  const eventManager = { broadcast: vi.fn().mockResolvedValue(undefined) }
  const commentRepository = { blockReader: vi.fn(), findById: vi.fn() }
  let service: CommentService

  beforeEach(() => {
    redisStore.clear()
    eventManager.broadcast.mockClear()
    commentRepository.findById.mockReset()
    commentRepository.blockReader.mockReset()
    service = new CommentService(
      commentRepository as any,
      {} as any,
      {} as any,
      eventManager as any,
      {} as any,
      {} as any,
      { lookupCountryCode: async () => null } as any,
      { getClient: () => redisClient } as any,
    )
  })

  it('notifies once and returns ok on a duplicate report', async () => {
    commentRepository.findById.mockResolvedValue({
      id: 'c1',
      text: 'hello',
    })
    await expect(
      service.reportComment('c1', { readerId: 'r1' }),
    ).resolves.toEqual({ notified: true })
    await expect(
      service.reportComment('c1', { readerId: 'r1' }),
    ).resolves.toEqual({ notified: false })
    expect(eventManager.broadcast).toHaveBeenCalledTimes(1)
  })

  it('throws when the comment is missing', async () => {
    commentRepository.findById.mockResolvedValue(null)
    await expect(
      service.reportComment('missing', { ip: '1.1.1.1' }),
    ).rejects.toBeInstanceOf(AppException)
    expect(eventManager.broadcast).not.toHaveBeenCalled()
  })

  it('reports and persists a reader block', async () => {
    commentRepository.findById.mockResolvedValue({
      id: 'c1',
      readerId: 'author-1',
      text: 'hello',
    })

    await expect(
      service.reportAndBlockComment('c1', {
        ip: '1.1.1.1',
        readerId: 'reader-1',
      }),
    ).resolves.toEqual({ blockedReaderId: 'author-1', notified: true })
    expect(commentRepository.blockReader).toHaveBeenCalledWith(
      'reader-1',
      'author-1',
    )
    expect(eventManager.broadcast).toHaveBeenCalledTimes(1)
  })
})

import { describe, expect, it, vi } from 'vitest'

import { createCommentRow } from '@/helper/comment-service-fixture'
import { CollectionRefTypes } from '~/constants/db.constant'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'

const createService = () => {
  const commentService = {
    findById: vi.fn().mockResolvedValue(createCommentRow()),
    updateComment: vi.fn(),
  }
  const configsService = {
    get: vi.fn(async (key: string) => {
      if (key === 'commentOptions') return { recordIpLocation: true }
      if (key === 'barkOptions') return { enable: true, enableComment: true }
      if (key === 'url') return { adminUrl: 'https://admin.example.com' }
      return {}
    }),
  }
  const ownerService = {
    getSiteOwnerOrMocked: vi.fn(),
    getOwner: vi.fn().mockResolvedValue({ name: 'Owner', username: 'owner' }),
  }
  const serverlessService = {
    repository: {
      findFunctionByNameReference: vi.fn().mockResolvedValue({ id: 'fn-1' }),
    },
    injectContextIntoServerlessFunctionAndCall: vi.fn().mockResolvedValue({
      countryName: 'CN',
      regionName: 'Zhejiang',
      cityName: 'Hangzhou',
    }),
  }
  const barkService = { push: vi.fn() }
  const service = new CommentLifecycleService(
    commentService as any,
    {} as any,
    configsService as any,
    ownerService as any,
    {} as any,
    {} as any,
    {} as any,
    serverlessService as any,
    { registerHandler: vi.fn() } as any,
    barkService as any,
    {} as any,
  )

  return { barkService, commentService, service }
}

describe('CommentLifecycleService', () => {
  it('appends serverless ip-location output to PG comment rows', async () => {
    const { commentService, service } = createService()

    await service.appendIpLocation('comment-1', '127.0.0.1')

    expect(commentService.updateComment).toHaveBeenCalledWith('comment-1', {
      location: 'CNZhejiangHangzhou',
    })
  })

  it('pushes comment notifications for non-owner comments', async () => {
    const { barkService, service } = createService()

    await service.pushCommentEvent(
      createCommentRow({
        author: 'Alice',
        refType: CollectionRefTypes.Post,
        text: 'hello',
      }) as any,
    )

    expect(barkService.push).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '收到一条新评论',
        body: expect.stringContaining('Alice'),
        url: 'https://admin.example.com#/comments',
      }),
    )
  })
})

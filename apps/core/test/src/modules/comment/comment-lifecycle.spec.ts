import { describe, expect, it, vi } from 'vitest'

import { createCommentRow } from '@/helper/comment-service-fixture'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'

const createService = () => {
  const commentService = {
    findById: vi.fn().mockResolvedValue(createCommentRow()),
    updateComment: vi.fn(),
    fillAndReplaceAvatarUrl: vi.fn(async (rows: any[]) => rows),
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
      findFunctionByPath: vi.fn().mockResolvedValue({ id: 'fn-1' }),
    },
    injectContextIntoServerlessFunctionAndCall: vi.fn().mockResolvedValue({
      countryName: 'CN',
      regionName: 'Zhejiang',
      cityName: 'Hangzhou',
    }),
  }
  const barkService = { push: vi.fn() }
  const eventManager = { broadcast: vi.fn(), registerHandler: vi.fn() }
  const service = new CommentLifecycleService(
    commentService as any,
    {} as any,
    configsService as any,
    ownerService as any,
    {} as any,
    {} as any,
    {} as any,
    serverlessService as any,
    eventManager as any,
    barkService as any,
    {} as any,
  )

  return { barkService, commentService, eventManager, service }
}

describe('CommentLifecycleService', () => {
  it('appends serverless ip-location output to PG comment rows', async () => {
    const { commentService, service } = createService()

    await service.appendIpLocation('comment-1', '127.0.0.1')

    expect(commentService.updateComment).toHaveBeenCalledWith('comment-1', {
      location: 'CNZhejiangHangzhou',
    })
  })

  it('enriches author/avatar via reader fill before broadcasting reply', async () => {
    const { commentService, eventManager, service } = createService()
    const rawComment = createCommentRow({
      id: 'comment-2',
      author: null,
      readerId: 'reader-1',
      avatar: null,
    })
    // Mirrors the production fill path: reader-resolved name + avatar
    // overwrite the row's null identity columns.
    commentService.fillAndReplaceAvatarUrl.mockImplementation(
      async (rows: any[]) => {
        for (const r of rows) {
          r.author = 'Bob'
          r.avatar = 'https://avatar.example.com/bob.png'
        }
        return rows
      },
    )

    await service.afterReplyComment(rawComment as any, { ip: '127.0.0.1' })

    expect(commentService.fillAndReplaceAvatarUrl).toHaveBeenCalledTimes(1)
    expect(eventManager.broadcast).toHaveBeenCalledWith(
      BusinessEvents.COMMENT_CREATE,
      expect.objectContaining({
        author: 'Bob',
        avatar: 'https://avatar.example.com/bob.png',
      }),
      expect.any(Object),
    )
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
        title: 'New comment received',
        body: expect.stringContaining('Alice'),
        url: 'https://admin.example.com#/comments',
      }),
    )
  })
})

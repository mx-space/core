import { describe, expect, it } from 'vitest'

import {
  createCommentRow,
  createCommentServiceFixture,
} from '@/helper/comment-service-fixture'
import { CollectionRefTypes } from '~/constants/db.constant'
import { CommentState } from '~/modules/comment/comment.enum'

describe('CommentService write operations', () => {
  it('creates root comments through the PG repository with resolved ref type', async () => {
    const { repository, service } = createCommentServiceFixture()
    repository.create.mockResolvedValue(createCommentRow())

    await service.createComment('post-1', { text: 'hello', author: 'Alice' })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'hello',
        author: 'Alice',
        refId: 'post-1',
        refType: CollectionRefTypes.Post,
        state: CommentState.Unread,
        parentCommentId: null,
        rootCommentId: null,
      }),
    )
  })

  it('persists country code on new comments and leaves is_owner_reply default false', async () => {
    const { commentCountryService, repository, service } =
      createCommentServiceFixture()
    commentCountryService.lookupCountryCode.mockResolvedValue('JP')
    repository.create.mockResolvedValue(createCommentRow())

    await service.createComment('post-1', {
      text: 'hi',
      author: 'Alice',
      ip: '1.2.3.4',
    })

    expect(commentCountryService.lookupCountryCode).toHaveBeenCalledWith(
      '1.2.3.4',
      expect.objectContaining({ cfHint: null }),
    )
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: 'JP' }),
    )
    // Root comments are never owner replies.
    expect(repository.create.mock.calls[0]?.[0]?.isOwnerReply).toBeUndefined()
  })

  it('flags owner replies and stamps country code on replyComment', async () => {
    const { commentCountryService, repository, service } =
      createCommentServiceFixture()
    commentCountryService.lookupCountryCode.mockResolvedValue('CN')
    repository.findById.mockResolvedValue(
      createCommentRow({
        id: 'parent-1',
        refType: CollectionRefTypes.Post,
        refId: 'post-1',
        rootCommentId: null,
        state: CommentState.Read,
      }),
    )
    repository.createReply.mockResolvedValue(
      createCommentRow({ id: 'reply-1' }),
    )

    const { RequestContext } = await import('~/common/contexts/request.context')
    const reqCtx = new RequestContext(
      { headers: { 'cf-ipcountry': 'CN' }, hasAdminAccess: true } as any,
      {} as any,
    )

    await RequestContext.run(reqCtx, async () => {
      await service.replyComment('parent-1', { text: 'hi', ip: '1.2.3.4' })
    })

    expect(repository.createReply).toHaveBeenCalledWith(
      expect.objectContaining({
        parentCommentId: 'parent-1',
        isOwnerReply: true,
        countryCode: 'CN',
      }),
    )
    expect(commentCountryService.lookupCountryCode).toHaveBeenCalledWith(
      '1.2.3.4',
      { cfHint: 'CN' },
    )
  })

  it('does not flag isOwnerReply when actor lacks admin access', async () => {
    const { repository, service } = createCommentServiceFixture()
    repository.findById.mockResolvedValue(
      createCommentRow({ id: 'parent-1', state: CommentState.Read }),
    )
    repository.createReply.mockResolvedValue(
      createCommentRow({ id: 'reply-1' }),
    )

    await service.replyComment('parent-1', { text: 'hi', ip: '1.2.3.4' })

    expect(repository.createReply).toHaveBeenCalledWith(
      expect.objectContaining({ isOwnerReply: false }),
    )
  })

  it('updates comment state in bulk through a repository batch call', async () => {
    const { repository, service } = createCommentServiceFixture()
    repository.updateStateBulk.mockResolvedValue(2)

    await expect(
      service.updateStateBulk(['comment-1', 'comment-2'], CommentState.Read),
    ).resolves.toBe(2)
    expect(repository.updateStateBulk).toHaveBeenCalledWith(
      ['comment-1', 'comment-2'],
      CommentState.Read,
    )
  })
})

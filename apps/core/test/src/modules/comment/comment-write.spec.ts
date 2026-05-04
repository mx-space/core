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

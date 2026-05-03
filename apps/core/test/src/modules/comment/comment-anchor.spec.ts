import { describe, expect, it } from 'vitest'

import {
  createCommentRow,
  createCommentServiceFixture,
} from '@/helper/comment-service-fixture'

describe('CommentService anchor updates', () => {
  it('preserves structured anchor payloads when updating comments', async () => {
    const { repository, service } = createCommentServiceFixture()
    repository.update.mockResolvedValue(
      createCommentRow({ anchor: { selector: '#intro' } as any }),
    )

    await service.updateComment('comment-1', {
      anchor: { selector: '#intro' },
    })

    expect(repository.update).toHaveBeenCalledWith('comment-1', {
      anchor: { selector: '#intro' },
    })
  })
})

import { describe, expect, it } from 'vitest'

import {
  createCommentRow,
  createCommentServiceFixture,
} from '@/helper/comment-service-fixture'

describe('CommentService thread queries', () => {
  it('attaches PG ref summaries to comment rows in admin lists', async () => {
    const { service } = createCommentServiceFixture()

    await expect(
      service.attachRef([createCommentRow()]),
    ).resolves.toMatchObject([
      {
        id: 'comment-1',
        ref: {
          id: 'post-1',
          title: 'Post',
          slug: 'post',
          category: { name: 'Default', slug: 'default' },
        },
      },
    ])
  })

  it('returns empty ref summaries when comments have no target ref', async () => {
    const { service } = createCommentServiceFixture()

    await expect(
      service.attachRef([createCommentRow({ refId: null as any })]),
    ).resolves.toMatchObject([{ id: 'comment-1', ref: null }])
  })
})

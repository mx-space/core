import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import v10_4_1 from '~/migration/version/v10.4.1'

describe('v10.4.1 comment flatten migration', () => {
  let comments: any[]
  let updateOne: ReturnType<typeof vi.fn>
  let updateMany: ReturnType<typeof vi.fn>

  beforeEach(() => {
    comments = [
      {
        _id: 'root-1',
        ref: 'post-1',
        refType: 'Post',
        children: ['reply-1', 'reply-2'],
        created: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        _id: 'reply-1',
        ref: 'post-1',
        refType: 'Post',
        parent: 'root-1',
        children: ['reply-1-1'],
        created: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        _id: 'reply-1-1',
        ref: 'post-1',
        refType: 'Post',
        parent: 'reply-1',
        children: [],
        created: new Date('2026-01-03T00:00:00.000Z'),
      },
      {
        _id: 'reply-2',
        ref: 'post-1',
        refType: 'Post',
        parent: 'root-1',
        children: [],
        created: new Date('2026-01-04T00:00:00.000Z'),
      },
    ]

    updateOne = vi.fn().mockResolvedValue({})
    updateMany = vi.fn().mockResolvedValue({})
  })

  it('backfills root and parent ids and thread summary fields', async () => {
    const db = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(comments),
        }),
        updateOne,
        updateMany,
      }),
    }

    await v10_4_1.run(db as any, {} as any)

    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'root-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          rootCommentId: null,
          parentCommentId: null,
          replyCount: 3,
          latestReplyAt: new Date('2026-01-04T00:00:00.000Z'),
          isDeleted: false,
        }),
      }),
    )
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'reply-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          rootCommentId: 'root-1',
          parentCommentId: 'root-1',
          isDeleted: false,
        }),
      }),
    )
    expect(updateMany).toHaveBeenCalledWith(
      {},
      {
        $unset: {
          children: 1,
          key: 1,
          commentsIndex: 1,
          parent: 1,
        },
      },
    )
  })

  it('preserves object id types when source comments use object ids', async () => {
    const rootId = new Types.ObjectId()
    const replyId = new Types.ObjectId()
    const commentsWithObjectIds = [
      {
        _id: rootId,
        created: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        _id: replyId,
        parent: rootId,
        created: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]

    const db = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(commentsWithObjectIds),
        }),
        updateOne,
        updateMany,
      }),
    }

    await v10_4_1.run(db as any, {} as any)

    expect(updateOne).toHaveBeenCalledWith(
      { _id: rootId },
      expect.objectContaining({
        $set: expect.objectContaining({
          rootCommentId: null,
          parentCommentId: null,
        }),
      }),
    )
    expect(updateOne).toHaveBeenCalledWith(
      { _id: replyId },
      expect.objectContaining({
        $set: expect.objectContaining({
          rootCommentId: rootId,
          parentCommentId: rootId,
        }),
      }),
    )
  })

  it('repairs string relation ids into object ids when partially flattened data exists', async () => {
    const rootId = new Types.ObjectId()
    const replyId = new Types.ObjectId()
    const repairedCollection = {
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: rootId,
            rootCommentId: rootId.toHexString(),
            parentCommentId: null,
          },
          {
            _id: replyId,
            rootCommentId: rootId.toHexString(),
            parentCommentId: rootId.toHexString(),
          },
        ]),
      }),
      updateOne,
    }

    const db = {
      collection: vi.fn().mockReturnValue(repairedCollection),
    }

    await v10_4_1.run(db as any, {} as any)

    expect(updateOne).toHaveBeenCalledWith(
      { _id: rootId },
      expect.objectContaining({
        $set: expect.objectContaining({
          rootCommentId: null,
          parentCommentId: null,
          isDeleted: false,
        }),
      }),
    )
    expect(updateOne).toHaveBeenCalledWith(
      { _id: replyId },
      expect.objectContaining({
        $set: expect.objectContaining({
          rootCommentId: rootId,
          parentCommentId: rootId,
          isDeleted: false,
        }),
      }),
    )
  })
})

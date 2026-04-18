import { Test } from '@nestjs/testing'
import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CommentState } from '~/modules/comment/comment.model'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { getModelToken } from '~/transformers/model.transformer'

const makeQueryChain = (result: unknown) => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  }

  return chain
}

describe('CommentService thread model', () => {
  let service: CommentService
  let mockCommentModel: any
  let mockRootContentModel: any

  const refId = new Types.ObjectId().toString()
  const rootCommentId = new Types.ObjectId().toString()
  const parentCommentId = new Types.ObjectId().toString()

  beforeEach(async () => {
    mockRootContentModel = {
      updateOne: vi.fn().mockResolvedValue({}),
    }

    mockCommentModel = {
      paginate: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      updateOne: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
      countDocuments: vi.fn().mockResolvedValue(0),
    }

    const module = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: getModelToken('CommentModel'), useValue: mockCommentModel },
        { provide: getModelToken('AITranslationModel'), useValue: {} },
        {
          provide: DatabaseService,
          useValue: {
            getModelByRefType: vi.fn().mockReturnValue(mockRootContentModel),
            findGlobalById: vi.fn(),
          },
        },
        {
          provide: OwnerService,
          useValue: {
            getOwner: vi.fn().mockResolvedValue({
              name: 'owner',
              avatar: 'https://example.com/owner.png',
            }),
            isOwnerName: vi.fn().mockResolvedValue(false),
          },
        },
        {
          provide: EventManagerService,
          useValue: { emit: vi.fn(), broadcast: vi.fn() },
        },
        {
          provide: ReaderService,
          useValue: { findReaderInIds: vi.fn().mockResolvedValue([]) },
        },
        { provide: LexicalService, useValue: new LexicalService() },
        {
          provide: ConfigsService,
          useValue: {
            get: vi.fn().mockResolvedValue({
              commentShouldAudit: false,
            }),
          },
        },
      ],
    }).compile()

    service = module.get(CommentService)
  })

  it('returns top-level comments with reply window when replies exceed threshold', async () => {
    const topLevel = {
      id: rootCommentId,
      _id: rootCommentId,
      author: 'root',
      text: 'root text',
      ref: refId,
      refType: 'Post',
      created: new Date('2026-01-10T00:00:00.000Z'),
      mail: 'root@example.com',
      pin: false,
      readerId: undefined,
      replyCount: 21,
      latestReplyAt: new Date('2026-01-30T00:00:00.000Z'),
      parentCommentId: null,
      rootCommentId: null,
    }

    const replies = Array.from({ length: 21 }, (_, index) => ({
      id: `reply-${index + 1}`,
      _id: `reply-${index + 1}`,
      author: `reply-${index + 1}`,
      text: `reply-text-${index + 1}`,
      ref: refId,
      refType: 'Post',
      created: new Date(
        `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      ),
      mail: `reply-${index + 1}@example.com`,
      readerId: undefined,
      parentCommentId: index === 0 ? rootCommentId : `reply-${index}`,
      rootCommentId,
    }))

    mockCommentModel.paginate.mockResolvedValue({
      docs: [topLevel],
      totalDocs: 1,
      limit: 10,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      pagingCounter: 1,
      prevPage: null,
      nextPage: null,
    })
    mockCommentModel.find.mockReturnValue(makeQueryChain(replies))

    const result = await service.getCommentsByRefId(refId, {
      page: 1,
      size: 10,
      isAuthenticated: false,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].replies.map((reply: any) => reply.id)).toEqual([
      'reply-1',
      'reply-2',
      'reply-3',
      'reply-19',
      'reply-20',
      'reply-21',
    ])
    expect(result.docs[0].replyWindow).toEqual({
      total: 21,
      returned: 6,
      threshold: 20,
      hasHidden: true,
      hiddenCount: 15,
      nextCursor: 'reply-3',
    })
  })

  it('queries replies with both object id and string root ids for migrated data', async () => {
    const topLevel = {
      id: rootCommentId,
      _id: new Types.ObjectId(rootCommentId),
      author: 'root',
      text: 'root text',
      ref: refId,
      refType: 'Post',
      created: new Date('2026-01-10T00:00:00.000Z'),
      mail: 'root@example.com',
      pin: false,
      readerId: undefined,
      replyCount: 1,
      latestReplyAt: new Date('2026-01-11T00:00:00.000Z'),
      parentCommentId: null,
      rootCommentId: null,
    }

    mockCommentModel.paginate.mockResolvedValue({
      docs: [topLevel],
      totalDocs: 1,
      limit: 10,
      page: 1,
      totalPages: 1,
      hasPrevPage: false,
      hasNextPage: false,
      pagingCounter: 1,
      prevPage: null,
      nextPage: null,
    })
    mockCommentModel.find.mockReturnValue(makeQueryChain([]))

    await service.getCommentsByRefId(refId, {
      page: 1,
      size: 10,
      isAuthenticated: false,
      commentShouldAudit: false,
    })

    const replyQuery = mockCommentModel.find.mock.calls[0][0]
    const inValues = replyQuery.$and[0].rootCommentId.$in
    expect(inValues).toEqual(
      expect.arrayContaining([rootCommentId, expect.any(Types.ObjectId)]),
    )
  })

  it('creates a reply with parent and root ids and updates root thread summary', async () => {
    const createdAt = new Date('2026-01-20T00:00:00.000Z')
    mockCommentModel.findById.mockResolvedValue({
      _id: parentCommentId,
      id: parentCommentId,
      ref: refId,
      refType: 'Post',
      rootCommentId,
      isWhispers: false,
      state: CommentState.Read,
    })
    mockCommentModel.create.mockImplementation(async (doc: any) => ({
      ...doc,
      _id: new Types.ObjectId(),
      id: 'reply-created',
      created: createdAt,
    }))

    const result = await service.replyComment(parentCommentId, {
      author: 'guest',
      mail: 'guest@example.com',
      text: 'reply text',
    })

    expect(mockCommentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parentCommentId,
        rootCommentId,
        ref: expect.any(Types.ObjectId),
        refType: 'Post',
      }),
    )
    expect(mockCommentModel.updateOne).toHaveBeenCalledWith(
      { _id: rootCommentId },
      {
        $inc: { replyCount: 1 },
        $set: { latestReplyAt: createdAt },
      },
    )
    expect(result.rootCommentId).toBe(rootCommentId)
  })

  it('soft deletes a comment without removing the record', async () => {
    mockCommentModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: parentCommentId,
        id: parentCommentId,
        isDeleted: false,
      }),
    })

    await service.softDeleteComment(parentCommentId)

    expect(mockCommentModel.updateOne).toHaveBeenCalledWith(
      { _id: parentCommentId },
      expect.objectContaining({
        $set: expect.objectContaining({
          isDeleted: true,
          text: '该评论已删除',
        }),
      }),
    )
  })

  describe('getCommentsByRefId sort + around', () => {
    const baseOpts = {
      page: 1,
      size: 10,
      isAuthenticated: false,
      commentShouldAudit: false,
    }

    const stubPaginate = () => {
      mockCommentModel.paginate.mockResolvedValue({
        docs: [],
        totalDocs: 0,
        limit: 10,
        page: 1,
        totalPages: 0,
        hasPrevPage: false,
        hasNextPage: false,
        pagingCounter: 1,
        prevPage: null,
        nextPage: null,
      })
      mockCommentModel.find.mockReturnValue(makeQueryChain([]))
    }

    it('uses { pin: -1, created: -1 } when sort is pinned (default)', async () => {
      stubPaginate()
      await service.getCommentsByRefId(refId, { ...baseOpts, sort: 'pinned' })
      expect(mockCommentModel.paginate.mock.calls[0][1].sort).toEqual({
        pin: -1,
        created: -1,
      })
    })

    it('uses { created: -1 } when sort is newest', async () => {
      stubPaginate()
      await service.getCommentsByRefId(refId, { ...baseOpts, sort: 'newest' })
      expect(mockCommentModel.paginate.mock.calls[0][1].sort).toEqual({
        created: -1,
      })
    })

    it('uses { created: 1 } when sort is oldest', async () => {
      stubPaginate()
      await service.getCommentsByRefId(refId, { ...baseOpts, sort: 'oldest' })
      expect(mockCommentModel.paginate.mock.calls[0][1].sort).toEqual({
        created: 1,
      })
    })

    it('around overrides page to the page that contains the target', async () => {
      stubPaginate()
      mockCommentModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: 'aroundId',
          ref: refId,
          created: new Date('2026-04-01T00:00:00Z'),
          pin: false,
        }),
      })
      mockCommentModel.countDocuments.mockResolvedValue(12)

      await service.getCommentsByRefId(refId, {
        ...baseOpts,
        page: 99,
        size: 5,
        sort: 'newest',
        around: 'aroundId',
      })

      // 13th item (index 12) under size=5 ⇒ page 3.
      expect(mockCommentModel.paginate.mock.calls[0][1].page).toBe(3)
    })

    it('falls back to the requested page when around id is not found', async () => {
      stubPaginate()
      mockCommentModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      })

      await service.getCommentsByRefId(refId, {
        ...baseOpts,
        page: 7,
        sort: 'newest',
        around: 'missingId',
      })

      expect(mockCommentModel.paginate.mock.calls[0][1].page).toBe(7)
    })
  })
})

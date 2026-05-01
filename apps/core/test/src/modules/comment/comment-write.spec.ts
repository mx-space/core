import type { ServerResponse } from 'node:http'

import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestContext } from '~/common/contexts/request.context'
import { CommentModel } from '~/modules/comment/comment.model'
import {
  AnonymousCommentSchema,
  AnonymousReplyCommentSchema,
  ReaderCommentSchema,
  ReaderReplyCommentSchema,
} from '~/modules/comment/comment.schema'
import { CommentService } from '~/modules/comment/comment.service'
import { generateDefaultConfig } from '~/modules/configs/configs.default'
import { ConfigsService } from '~/modules/configs/configs.service'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'
import { getModelToken } from '~/transformers/model.transformer'

describe('Comment write schemas', () => {
  it('accepts text-only payload for logged-in top-level comments', () => {
    const result = ReaderCommentSchema.safeParse({
      text: 'hello world',
    })

    expect(result.success).toBe(true)
  })

  it('accepts text-only payload for logged-in replies', () => {
    const result = ReaderReplyCommentSchema.safeParse({
      text: 'hello reply',
    })

    expect(result.success).toBe(true)
  })

  it('requires identity fields for anonymous top-level comments', () => {
    const result = AnonymousCommentSchema.safeParse({
      text: 'hello world',
    })

    expect(result.success).toBe(false)
  })

  it('requires identity fields for anonymous replies', () => {
    const result = AnonymousReplyCommentSchema.safeParse({
      text: 'hello reply',
    })

    expect(result.success).toBe(false)
  })

  it('defaults allowGuestComment to true', () => {
    expect(generateDefaultConfig().commentOptions.allowGuestComment).toBe(true)
  })

  it('does not require author at the mongoose model layer for reader-linked comments', () => {
    const model = getModelForClass(CommentModel)

    expect(model.schema.path('author').isRequired).not.toBe(true)
  })
})

describe('CommentService logged-in identity handling', () => {
  let service: CommentService
  let mockCommentModel: any
  let mockRootContentModel: any
  let mockReaderService: { findReaderInIds: ReturnType<typeof vi.fn> }

  const refId = new Types.ObjectId().toString()

  beforeEach(async () => {
    mockRootContentModel = {
      findById: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: refId,
          commentsIndex: 0,
          content: 'hello',
        }),
      }),
      updateOne: vi.fn().mockResolvedValue({}),
    }

    mockCommentModel = {
      create: vi.fn().mockImplementation(async (doc: any) => ({
        ...doc,
        _id: new Types.ObjectId(),
        id: new Types.ObjectId().toString(),
      })),
      updateOne: vi.fn().mockResolvedValue({}),
      paginate: vi.fn(),
      find: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
      findById: vi.fn(),
      findOne: vi.fn(),
    }

    mockReaderService = {
      findReaderInIds: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          id: 'reader-1',
          name: 'Reader One',
          email: 'reader@example.com',
          image: 'https://example.com/reader.png',
          role: 'reader',
        },
      ]),
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
            findGlobalById: vi.fn().mockResolvedValue({
              type: 'Post',
              document: {
                _id: refId,
                commentsIndex: 0,
                content: 'hello',
              },
            }),
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
          useValue: mockReaderService,
        },
        { provide: LexicalService, useValue: new LexicalService() },
        {
          provide: FileReferenceService,
          useValue: {
            attachReaderImagesToComment: vi.fn().mockResolvedValue({
              attachedCount: 0,
              detachedCount: 0,
            }),
            hardDeleteFilesForComment: vi.fn().mockResolvedValue(0),
          },
        },
        {
          provide: ConfigsService,
          useValue: {
            get: vi.fn().mockResolvedValue({}),
            waitForConfigReady: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile()

    service = module.get(CommentService)
  })

  it('stores logged-in comments by readerId without copying identity snapshot fields', async () => {
    const request = {
      readerId: 'reader-1',
      authProvider: 'github',
      isAuthenticated: false,
      isGuest: true,
    } as BizIncomingMessage
    const response = {} as ServerResponse

    await RequestContext.run(
      new RequestContext(request, response),
      async () => {
        await service.createComment(refId, {
          text: 'hello from reader',
        })
      },
    )

    expect(mockCommentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'hello from reader',
        readerId: 'reader-1',
        authProvider: 'github',
      }),
    )

    const createdDoc = mockCommentModel.create.mock.calls[0][0]
    expect(createdDoc.author).toBeUndefined()
    expect(createdDoc.mail).toBeUndefined()
    expect(createdDoc.avatar).toBeUndefined()
  })

  it('hydrates reader-linked comments with dynamic reader identity', async () => {
    const comments = [
      {
        _id: new Types.ObjectId().toString(),
        readerId: 'reader-1',
        author: 'stale author',
        text: 'hello from reader',
      } as any,
    ]

    await service.fillAndReplaceAvatarUrl(comments)

    expect(comments[0].author).toBe('Reader One')
    expect(comments[0].avatar).toBe('https://example.com/reader.png')
  })
})

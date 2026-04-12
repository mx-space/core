import { Test } from '@nestjs/testing'
import { Types } from 'mongoose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CommentAnchorMode } from '~/modules/comment/comment.model'
import { CommentAnchorSchema } from '~/modules/comment/comment.schema'
import { CommentService } from '~/modules/comment/comment.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { getModelToken } from '~/transformers/model.transformer'

function makeLexicalContent(blocks: { id: string; text: string }[]): string {
  return JSON.stringify({
    root: {
      children: blocks.map((b) => ({
        type: 'paragraph',
        $: { blockId: b.id },
        children: [{ type: 'text', text: b.text }],
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  })
}

describe('CommentAnchorSchema — lang field', () => {
  it('accepts block anchor with lang', () => {
    const result = CommentAnchorSchema.safeParse({
      mode: CommentAnchorMode.Block,
      blockId: 'b1',
      lang: 'en',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.lang).toBe('en')
  })

  it('accepts block anchor without lang', () => {
    const result = CommentAnchorSchema.safeParse({
      mode: CommentAnchorMode.Block,
      blockId: 'b1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts block anchor with lang=null', () => {
    const result = CommentAnchorSchema.safeParse({
      mode: CommentAnchorMode.Block,
      blockId: 'b1',
      lang: null,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.lang).toBeNull()
  })

  it('rejects lang with empty string', () => {
    const result = CommentAnchorSchema.safeParse({
      mode: CommentAnchorMode.Block,
      blockId: 'b1',
      lang: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects lang exceeding 10 chars', () => {
    const result = CommentAnchorSchema.safeParse({
      mode: CommentAnchorMode.Block,
      blockId: 'b1',
      lang: 'verylongname',
    })
    expect(result.success).toBe(false)
  })

  it('accepts range anchor with lang', () => {
    const result = CommentAnchorSchema.safeParse({
      mode: CommentAnchorMode.Range,
      blockId: 'b1',
      quote: 'hello',
      prefix: '',
      suffix: '',
      startOffset: 0,
      endOffset: 5,
      lang: 'ja',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.lang).toBe('ja')
  })
})

describe('CommentService — lang-aware anchor resolution', () => {
  let service: CommentService
  let mockCommentModel: any
  let mockAiTranslationModel: any
  let mockLexicalService: any
  let mockDatabaseService: any
  let mockRefModel: any

  const refId = new Types.ObjectId()
  const refIdString = refId.toString()
  const originalContent = makeLexicalContent([
    { id: 'block-1', text: 'Original paragraph one' },
    { id: 'block-2', text: 'Original paragraph two' },
  ])
  const translationContent = makeLexicalContent([
    { id: 'block-1', text: 'Translated paragraph one' },
    { id: 'block-2', text: 'Translated paragraph two' },
  ])

  beforeEach(async () => {
    mockCommentModel = {
      create: vi.fn().mockImplementation((doc: any) => ({
        ...doc,
        _id: new Types.ObjectId(),
        id: new Types.ObjectId().toString(),
      })),
      find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      findById: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue(null),
        }),
      }),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: vi.fn().mockResolvedValue({}),
      findOne: vi
        .fn()
        .mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
      paginate: vi.fn(),
    }

    mockAiTranslationModel = {
      findOne: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    }

    mockLexicalService = new LexicalService()

    mockRefModel = {
      findById: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          id: refIdString,
          content: originalContent,
          contentFormat: ContentFormat.Lexical,
          commentsIndex: 0,
        }),
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            id: refIdString,
            content: originalContent,
            contentFormat: ContentFormat.Lexical,
          }),
        }),
      }),
      updateOne: vi.fn().mockResolvedValue({}),
    }

    mockDatabaseService = {
      getModelByRefType: vi.fn().mockReturnValue(mockRefModel),
      findGlobalById: vi.fn().mockResolvedValue({
        type: 'Post',
        document: {
          id: refIdString,
          content: originalContent,
          contentFormat: ContentFormat.Lexical,
          commentsIndex: 0,
        },
      }),
    }

    const module = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: getModelToken('CommentModel'), useValue: mockCommentModel },
        {
          provide: getModelToken('AITranslationModel'),
          useValue: mockAiTranslationModel,
        },
        { provide: DatabaseService, useValue: mockDatabaseService },
        {
          provide: OwnerService,
          useValue: {
            getSiteOwnerOrMocked: vi.fn().mockResolvedValue({ name: 'test' }),
            getOwner: vi.fn(),
            isOwnerName: vi.fn(),
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
        { provide: LexicalService, useValue: mockLexicalService },
      ],
    }).compile()

    service = module.get(CommentService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveAnchorForCreate (via createComment)', () => {
    it('resolves anchor from original content when lang is null', async () => {
      const doc: any = {
        author: 'tester',
        mail: 'test@test.com',
        text: 'test comment',
        anchor: {
          mode: CommentAnchorMode.Block,
          blockId: 'block-1',
          lang: null,
        },
      }

      await service.createComment(refId.toString(), doc)

      expect(mockAiTranslationModel.findOne).not.toHaveBeenCalled()
      expect(mockRefModel.updateOne).toHaveBeenCalledWith(
        { _id: refIdString },
        { $inc: { commentsIndex: 1 } },
      )
      expect(doc.anchor.blockId).toBe('block-1')
      expect(doc.anchor.lang).toBeUndefined()
    })

    it('resolves anchor from translation content when lang is set', async () => {
      mockAiTranslationModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          contentFormat: ContentFormat.Lexical,
          content: translationContent,
        }),
      })

      const doc: any = {
        author: 'tester',
        mail: 'test@test.com',
        text: 'test comment',
        anchor: {
          mode: CommentAnchorMode.Block,
          blockId: 'block-1',
          lang: 'en',
        },
      }

      await service.createComment(refId.toString(), doc)

      expect(mockAiTranslationModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ refId: refIdString, lang: 'en' }),
      )
      expect(doc.anchor.lang).toBe('en')
      expect(doc.anchor.snapshotText).toBe('Translated paragraph one')
    })

    it('falls back to original when translation not found', async () => {
      mockAiTranslationModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      })

      const doc: any = {
        author: 'tester',
        mail: 'test@test.com',
        text: 'test comment',
        anchor: {
          mode: CommentAnchorMode.Block,
          blockId: 'block-1',
          lang: 'en',
        },
      }

      await service.createComment(refId.toString(), doc)

      expect(doc.anchor.snapshotText).toBe('Original paragraph one')
    })

    it('resolves range anchor from translation text', async () => {
      mockAiTranslationModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          contentFormat: ContentFormat.Lexical,
          content: translationContent,
        }),
      })

      const doc: any = {
        author: 'tester',
        mail: 'test@test.com',
        text: 'test comment',
        anchor: {
          mode: CommentAnchorMode.Range,
          blockId: 'block-1',
          quote: 'Translated',
          prefix: '',
          suffix: ' paragraph',
          startOffset: 0,
          endOffset: 10,
          lang: 'en',
        },
      }

      await service.createComment(refId.toString(), doc)

      expect(doc.anchor.quote).toBe('Translated')
      expect(doc.anchor.lang).toBe('en')
      expect(doc.anchor.snapshotText).toBe('Translated paragraph one')
    })
  })

  describe('reanchorCommentsByRef — skip translation anchors', () => {
    it('query excludes comments with non-null anchor.lang', async () => {
      const findMock = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      })
      mockCommentModel.find = findMock

      // Trigger reanchor via event handler
      await (service as any).handlePostUpdate({ id: refId.toString() })

      expect(findMock).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            expect.objectContaining({
              $or: [
                { 'anchor.lang': null },
                { 'anchor.lang': { $exists: false } },
              ],
            }),
          ]),
        }),
      )
    })
  })
})

import type { ServerResponse } from 'node:http'

import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestContext } from '~/common/contexts/request.context'
import type { BizException } from '~/common/exceptions/biz.exception'
import { AuthGuard } from '~/common/guards/auth.guard'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { CommentController } from '~/modules/comment/comment.controller'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'

describe('CommentController permission gating', () => {
  let controller: CommentController
  const mockCommentService = {
    allowComment: vi.fn(),
    allowCommentByCommentId: vi.fn(),
    createComment: vi.fn(),
    replyComment: vi.fn(),
    fillAndReplaceAvatarUrl: vi.fn(async (docs: any[]) => docs),
  }
  const mockLifecycleService = {
    afterCreateComment: vi.fn(),
    afterReplyComment: vi.fn(),
  }
  const mockConfigsService = {
    get: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockConfigsService.get.mockResolvedValue({
      disableComment: false,
      allowGuestComment: true,
    })
    mockCommentService.createComment.mockResolvedValue({
      id: 'comment-created',
      text: 'hello',
    })
    mockCommentService.replyComment.mockResolvedValue({
      id: 'reply-created',
      text: 'reply',
    })

    const module = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
        {
          provide: AuthGuard,
          useValue: { canActivate: vi.fn().mockResolvedValue(true) },
        },
        {
          provide: AuthService,
          useValue: { getSessionUser: vi.fn() },
        },
        {
          provide: CommentLifecycleService,
          useValue: mockLifecycleService,
        },
        {
          provide: EventManagerService,
          useValue: { emit: vi.fn() },
        },
        {
          provide: ConfigsService,
          useValue: mockConfigsService,
        },
        {
          provide: ReaderService,
          useValue: {
            findReaderInIds: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile()

    controller = module.get(CommentController)
  })

  const runAsAdmin = <T>(callback: () => Promise<T>) => {
    const request = {
      hasAdminAccess: true,
      hasReaderIdentity: true,
      isAuthenticated: true,
      isGuest: false,
      readerId: 'owner-reader-id',
      user: {
        id: 'owner-reader-id',
        role: 'owner',
      },
    } as BizIncomingMessage
    const response = {} as ServerResponse
    return RequestContext.run(new RequestContext(request, response), callback)
  }

  it('blocks logged-in top-level comments when target content disables comments', async () => {
    mockCommentService.allowComment.mockResolvedValue(false)

    await expect(
      controller.readerComment(
        { id: 'post-1' },
        { text: 'hello' } as any,
        'reader-1',
        {} as any,
        { ref: undefined } as any,
      ),
    ).rejects.toMatchObject<Partial<BizException>>({
      bizCode: ErrorCodeEnum.CommentForbidden,
    })

    expect(mockCommentService.createComment).not.toHaveBeenCalled()
  })

  it('blocks logged-in replies when parent comment ref disables comments', async () => {
    mockCommentService.allowCommentByCommentId.mockResolvedValue(false)

    await expect(
      controller.readerReplyByCid(
        { id: 'comment-1' },
        { text: 'reply' } as any,
        'reader-1',
        {} as any,
      ),
    ).rejects.toMatchObject<Partial<BizException>>({
      bizCode: ErrorCodeEnum.CommentForbidden,
    })

    expect(mockCommentService.replyComment).not.toHaveBeenCalled()
  })

  it('allows owner top-level comments even when disableComment is enabled and target content disables comments', async () => {
    mockConfigsService.get.mockResolvedValue({
      disableComment: true,
      allowGuestComment: true,
    })
    mockCommentService.allowComment.mockResolvedValue(false)

    await expect(
      runAsAdmin(() =>
        controller.readerComment(
          { id: 'post-1' },
          { text: 'owner hello' } as any,
          'owner-reader-id',
          {} as any,
          { ref: undefined } as any,
        ),
      ),
    ).resolves.toMatchObject({
      id: 'comment-created',
    })

    expect(mockCommentService.createComment).toHaveBeenCalled()
  })

  it('allows owner replies even when disableComment is enabled and parent ref disables comments', async () => {
    mockConfigsService.get.mockResolvedValue({
      disableComment: true,
      allowGuestComment: true,
    })
    mockCommentService.allowCommentByCommentId.mockResolvedValue(false)

    await expect(
      runAsAdmin(() =>
        controller.readerReplyByCid(
          { id: 'comment-1' },
          { text: 'owner reply' } as any,
          'owner-reader-id',
          {} as any,
        ),
      ),
    ).resolves.toMatchObject({
      id: 'reply-created',
    })

    expect(mockCommentService.replyComment).toHaveBeenCalled()
  })
})

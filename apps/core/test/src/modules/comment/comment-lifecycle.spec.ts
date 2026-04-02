import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CommentReplyMailType } from '~/modules/comment/comment.enum'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'
import { CommentSpamFilterService } from '~/modules/comment/comment.spam-filter'
import { ConfigsService } from '~/modules/configs/configs.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetType } from '~/modules/snippet/snippet.model'
import { DatabaseService } from '~/processors/database/database.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { getModelToken } from '~/transformers/model.transformer'

const ownerInfo = {
  id: 'owner-id',
  name: 'Owner Name',
  mail: 'owner@example.com',
  avatar: 'https://example.com/owner.png',
}

describe('CommentLifecycleService email routing', () => {
  let service: CommentLifecycleService
  let mockCommentModel: any
  let mockConfigsService: any
  let mockOwnerService: any
  let mockReaderService: any
  let mockMailService: any
  let mockEventManager: any
  let mockSpamFilterService: any
  let mockRefModel: any
  let mockBarkService: any

  beforeEach(async () => {
    vi.useFakeTimers()

    mockRefModel = {
      findById: vi.fn().mockResolvedValue({
        id: 'post-1',
        title: 'Post Title',
        text: 'Post Content',
        created: new Date('2026-01-01T00:00:00.000Z'),
        modified: null,
      }),
    }

    mockCommentModel = {
      findById: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn().mockResolvedValue({}),
    }

    mockConfigsService = {
      get: vi.fn().mockImplementation(async (key: string) => {
        if (key === 'commentOptions') {
          return {
            commentShouldAudit: false,
            recordIpLocation: false,
          }
        }

        if (key === 'mailOptions') {
          return { enable: true }
        }

        if (key === 'barkOptions') {
          return { enable: false, enableComment: false }
        }

        if (key === 'url') {
          return { adminUrl: 'https://admin.example.com/' }
        }

        return {}
      }),
      waitForConfigReady: vi.fn().mockResolvedValue({
        seo: { title: 'Mx Space' },
        mailOptions: { from: 'noreply@example.com', smtp: { user: '' } },
        url: { webUrl: 'https://mx.example.com/' },
      }),
    }

    mockOwnerService = {
      getSiteOwnerOrMocked: vi.fn().mockResolvedValue(ownerInfo),
      getOwnerInfo: vi.fn().mockResolvedValue(ownerInfo),
      getOwner: vi.fn().mockResolvedValue(ownerInfo),
    }

    mockReaderService = {
      findReaderInIds: vi.fn().mockResolvedValue([]),
    }

    mockMailService = {
      registerEmailType: vi.fn(),
      readTemplate: vi.fn().mockResolvedValue('<div><%= owner %></div>'),
      send: vi.fn().mockResolvedValue(undefined),
    }

    let registeredHandler: any
    mockEventManager = {
      broadcast: vi.fn().mockResolvedValue(undefined),
      registerHandler: vi.fn((handler) => {
        registeredHandler = handler
        return vi.fn()
      }),
      get registeredHandler() {
        return registeredHandler
      },
    }

    mockSpamFilterService = {
      checkSpam: vi.fn().mockResolvedValue(false),
    }

    mockBarkService = {
      push: vi.fn().mockResolvedValue(undefined),
    }

    const module = await Test.createTestingModule({
      providers: [
        CommentLifecycleService,
        { provide: getModelToken('CommentModel'), useValue: mockCommentModel },
        {
          provide: DatabaseService,
          useValue: {
            getModelByRefType: vi.fn().mockReturnValue(mockRefModel),
          },
        },
        { provide: ConfigsService, useValue: mockConfigsService },
        { provide: OwnerService, useValue: mockOwnerService },
        { provide: ReaderService, useValue: mockReaderService },
        { provide: EmailService, useValue: mockMailService },
        { provide: EventManagerService, useValue: mockEventManager },
        {
          provide: BarkPushService,
          useValue: mockBarkService,
        },
        {
          provide: ServerlessService,
          useValue: {
            model: {
              findOne: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  lean: vi.fn().mockResolvedValue({
                    name: 'ip',
                    reference: 'built-in',
                    type: SnippetType.Function,
                  }),
                }),
              }),
            },
            injectContextIntoServerlessFunctionAndCall: vi.fn(),
          },
        },
        {
          provide: CommentSpamFilterService,
          useValue: mockSpamFilterService,
        },
      ],
    }).compile()

    service = module.get(CommentLifecycleService)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('notifies owner for reader-linked top-level comments even without snapshot mail', async () => {
    const comment = {
      id: 'comment-1',
      _id: 'comment-1',
      ref: 'post-1',
      refType: 'Post',
      readerId: 'reader-1',
      text: 'reader top-level comment',
      created: new Date('2026-01-10T00:00:00.000Z'),
      isWhispers: false,
    }
    const query = {
      lean: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue(comment),
    }
    mockCommentModel.findById.mockReturnValue(query)

    const sendEmailSpy = vi
      .spyOn(service, 'sendEmail')
      .mockResolvedValue(undefined)
    vi.spyOn(service, 'appendIpLocation').mockResolvedValue(undefined)

    await service.afterCreateComment('comment-1', { ip: '1.1.1.1' })
    await vi.runAllTimersAsync()

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'comment-1', readerId: 'reader-1' }),
      CommentReplyMailType.Owner,
    )
  })

  it('pushes bark notification only once for duplicated comment create scopes', async () => {
    await service.onModuleInit()
    const pushCommentEventSpy = vi
      .spyOn(service, 'pushCommentEvent')
      .mockResolvedValue(undefined)

    const comment = {
      id: 'comment-1',
      author: 'Guest User',
      text: 'hello world',
      refType: 'Post',
      avatar: 'https://example.com/avatar.png',
    }

    await mockEventManager.registeredHandler(
      BusinessEvents.COMMENT_CREATE,
      comment,
      EventScope.TO_SYSTEM_ADMIN,
    )
    await mockEventManager.registeredHandler(
      BusinessEvents.COMMENT_CREATE,
      comment,
      EventScope.TO_VISITOR,
    )

    expect(pushCommentEventSpy).toHaveBeenCalledTimes(1)
    expect(pushCommentEventSpy).toHaveBeenCalledWith(comment)
  })

  it('resolves owner-notification sender mail from reader identity', async () => {
    mockCommentModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    })
    mockReaderService.findReaderInIds.mockResolvedValue([
      {
        _id: 'reader-1',
        id: 'reader-1',
        role: 'reader',
        name: 'Reader One',
        email: 'reader@example.com',
        image: 'https://example.com/reader.png',
      },
    ])

    const sendCommentNotificationMailSpy = vi
      .spyOn(service as any, 'sendCommentNotificationMail')
      .mockResolvedValue(undefined)

    await service.sendEmail(
      {
        id: 'comment-1',
        ref: 'post-1',
        refType: 'Post',
        parentCommentId: null,
        text: 'reader top-level comment',
        readerId: 'reader-1',
        created: new Date('2026-01-10T00:00:00.000Z'),
        isWhispers: false,
      } as any,
      CommentReplyMailType.Owner,
    )

    expect(sendCommentNotificationMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ownerInfo.mail,
        source: expect.objectContaining({
          author: 'Reader One',
          mail: 'reader@example.com',
        }),
      }),
    )
  })

  it('resolves reply-recipient mail from parent reader identity', async () => {
    mockCommentModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        id: 'parent-1',
        readerId: 'reader-parent',
        text: 'parent comment',
        created: new Date('2026-01-09T00:00:00.000Z'),
      }),
    })
    mockReaderService.findReaderInIds.mockImplementation(
      async (ids: string[]) => {
        if (ids[0] === 'reader-parent') {
          return [
            {
              _id: 'reader-parent',
              id: 'reader-parent',
              role: 'reader',
              name: 'Parent Reader',
              email: 'parent@example.com',
              image: 'https://example.com/parent.png',
            },
          ]
        }

        return []
      },
    )

    const sendCommentNotificationMailSpy = vi
      .spyOn(service as any, 'sendCommentNotificationMail')
      .mockResolvedValue(undefined)

    await service.sendEmail(
      {
        id: 'reply-1',
        ref: 'post-1',
        refType: 'Post',
        parentCommentId: 'parent-1',
        text: 'owner reply text',
        created: new Date('2026-01-10T00:00:00.000Z'),
        isWhispers: false,
      } as any,
      CommentReplyMailType.Guest,
    )

    expect(sendCommentNotificationMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'parent@example.com',
        source: expect.objectContaining({
          owner: ownerInfo.name,
          mail: ownerInfo.mail,
        }),
      }),
    )
  })
})

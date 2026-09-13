import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { SubscribePostCreateBit } from '~/modules/subscribe/subscribe.constant'
import { SubscribeService } from '~/modules/subscribe/subscribe.service'

describe('SubscribeService public content mail', () => {
  let handler:
    | ((event: BusinessEvents, data: unknown, scope: EventScope) => void)
    | undefined

  const subscribeRepository = {
    findAll: vi.fn(),
    list: vi.fn(),
    findByEmail: vi.fn(),
    updateByEmail: vi.fn(),
    create: vi.fn(),
    deleteByEmail: vi.fn(),
    deleteAll: vi.fn(),
    deleteByEmails: vi.fn(),
  }
  const eventManager = {
    on: vi.fn(),
    registerHandler: vi.fn((next) => {
      handler = next
      return vi.fn()
    }),
  }
  const databaseService = {
    findGlobalById: vi.fn(),
  }
  const configService = {
    get: vi.fn(),
    waitForConfigReady: vi.fn(),
  }
  const urlBuilderService = {
    isNoteModel: vi.fn((model: { nid?: unknown }) => model.nid != null),
    buildWithBaseUrl: vi.fn(),
  }
  const emailService = {
    registerEmailType: vi.fn(),
    readTemplate: vi.fn(),
    send: vi.fn(),
  }
  const ownerService = {
    getSiteOwnerOrMocked: vi.fn(),
    getOwner: vi.fn(),
  }

  const publishedPost = {
    id: 'post-1',
    title: 'Draft went live',
    text: 'Hello world from a published draft.',
    createdAt: new Date('2026-09-13T00:00:00.000Z'),
    isPublished: true,
    slug: 'draft-went-live',
  }

  const createService = () =>
    new SubscribeService(
      subscribeRepository as never,
      eventManager as never,
      databaseService as never,
      configService as never,
      urlBuilderService as never,
      emailService as never,
      ownerService as never,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    handler = undefined
    subscribeRepository.findAll.mockResolvedValue([
      {
        email: 'reader@example.com',
        subscribe: SubscribePostCreateBit,
        cancelToken: 'token-1',
      },
    ])
    databaseService.findGlobalById.mockResolvedValue({
      type: 'post',
      document: publishedPost,
    })
    configService.get.mockResolvedValue({ serverUrl: 'https://example.com' })
    configService.waitForConfigReady.mockResolvedValue({
      featureList: { emailSubscribe: true },
      mailOptions: {
        enable: true,
        from: 'blog@example.com',
        smtp: { user: 'blog@example.com' },
      },
      seo: { title: 'Mix Space' },
    })
    urlBuilderService.buildWithBaseUrl.mockResolvedValue(
      'https://example.com/posts/journal/draft-went-live',
    )
    emailService.readTemplate.mockResolvedValue('<p><%= title %></p>')
    emailService.send.mockResolvedValue(undefined)
    ownerService.getSiteOwnerOrMocked.mockResolvedValue({ name: 'Innei' })
    ownerService.getOwner.mockResolvedValue({ name: 'Innei' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([BusinessEvents.POST_REPUBLISH, BusinessEvents.NOTE_REPUBLISH])(
    'sends newsletter mail on %s',
    async (event) => {
      const service = createService()
      await service.onModuleInit()
      handler?.(event, { id: 'post-1' }, EventScope.TO_SYSTEM_VISITOR)

      await vi.waitFor(() => expect(emailService.send).toHaveBeenCalledOnce())
      expect(emailService.send.mock.calls[0]![0]).toMatchObject({
        to: 'reader@example.com',
        subject: '[Mix Space] New content published',
      })
      await service.onModuleDestroy()
    },
  )

  it('does not mail unpublished POST_CREATE that never reaches visitors', async () => {
    const service = createService()
    await service.onModuleInit()
    handler?.(
      BusinessEvents.POST_CREATE,
      { id: 'post-1' },
      EventScope.TO_SYSTEM,
    )

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(databaseService.findGlobalById).not.toHaveBeenCalled()
    expect(emailService.send).not.toHaveBeenCalled()
    await service.onModuleDestroy()
  })
})

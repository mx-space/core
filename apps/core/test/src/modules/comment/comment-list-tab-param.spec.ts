import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthGuard } from '~/common/guards/auth.guard'
import { AuthService } from '~/modules/auth/auth.service'
import { CommentController } from '~/modules/comment/comment.controller'
import { CommentLifecycleService } from '~/modules/comment/comment.lifecycle.service'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EntitlementService } from '~/modules/membership/entitlement.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'

/**
 * Spec §6.2: `?tab=` is the canonical filter. `?state=` is honored as a
 * deprecated alias for one release and the response carries
 * `Deprecation: true`. When both are supplied, `tab` wins (the deprecated
 * parameter never overrides the new one).
 */
describe('CommentController list tab/state/author parameters', () => {
  let controller: CommentController
  const mockService = {
    getComments: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockService.getComments.mockResolvedValue({
      data: [],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 0,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const module = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        { provide: CommentService, useValue: mockService },
        {
          provide: AuthGuard,
          useValue: { canActivate: vi.fn().mockResolvedValue(true) },
        },
        { provide: AuthService, useValue: { getSessionUser: vi.fn() } },
        {
          provide: CommentLifecycleService,
          useValue: {
            afterCreateComment: vi.fn(),
            afterReplyComment: vi.fn(),
          },
        },
        { provide: EventManagerService, useValue: { emit: vi.fn() } },
        {
          provide: ConfigsService,
          useValue: {
            get: vi.fn().mockResolvedValue({
              disableComment: false,
              allowGuestComment: true,
            }),
          },
        },
        {
          provide: ReaderService,
          useValue: { findReaderInIds: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: EntitlementService,
          useValue: {
            getActiveMemberIds: vi.fn().mockResolvedValue(new Set()),
          },
        },
      ],
    }).compile()

    controller = module.get(CommentController)
  })

  const makeReply = () => {
    const headers = new Map<string, string>()
    const reply = {
      header: vi.fn((name: string, value: string) => {
        headers.set(name, value)
      }),
    } as any
    return { reply, headers }
  }

  it('passes ?tab= through to the service filter and skips state', async () => {
    const { reply, headers } = makeReply()
    await controller.getRecentlyComments(
      { tab: 'unread', page: 1, size: 10 } as any,
      reply,
    )

    expect(mockService.getComments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ tab: 'unread' }),
      }),
    )
    expect(headers.has('Deprecation')).toBe(false)
  })

  it('passes ?author= through to the service filter', async () => {
    const { reply } = makeReply()
    await controller.getRecentlyComments(
      { author: 'alice@example.com', page: 1, size: 10 } as any,
      reply,
    )

    expect(mockService.getComments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ author: 'alice@example.com' }),
      }),
    )
  })

  it('emits Deprecation: true when only state is supplied', async () => {
    const { reply, headers } = makeReply()
    await controller.getRecentlyComments(
      { state: 0, page: 1, size: 10 } as any,
      reply,
    )

    expect(headers.get('Deprecation')).toBe('true')
    expect(mockService.getComments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ state: 0 }),
      }),
    )
  })

  it('does not emit Deprecation header when tab is also supplied (tab wins)', async () => {
    const { reply, headers } = makeReply()
    await controller.getRecentlyComments(
      { tab: 'whispers', state: 0, page: 1, size: 10 } as any,
      reply,
    )

    expect(headers.has('Deprecation')).toBe(false)
    // The controller passes tab; the service-level normalize drops state.
    expect(mockService.getComments).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ tab: 'whispers' }),
      }),
    )
    const filter = mockService.getComments.mock.calls[0]?.[0]?.filter
    expect(filter.state).toBeUndefined()
  })
})

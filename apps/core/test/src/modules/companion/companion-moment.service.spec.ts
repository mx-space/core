import { vi } from 'vitest'

import { CompanionMomentService } from '~/modules/companion/companion-moment.service'

const request = {
  meta: {
    schema: 'yohaku.companion.moment' as const,
    schemaVersion: 1 as const,
    requestId: '01K0A5Q2R7Y5VXG4H7Q0F4M9J2',
    observedAt: '2026-07-16T12:00:00.000Z',
  },
  data: {
    content: 'A concise progress note.',
    application: {
      displayName: 'Xcode',
      activity: { key: 'editing', customLabel: null },
      window: null,
      icon: null,
    },
    media: null,
  },
}

const principal = {
  deviceId: 'device-1',
  ownerId: 'owner-1',
  scopes: ['companion:moment:write' as const],
}

describe('CompanionMomentService', () => {
  it('stores public context metadata without device identity', async () => {
    const recentlyService = {
      create: vi.fn().mockResolvedValue({
        id: '123456789',
        createdAt: new Date('2026-07-16T12:00:00.100Z'),
      }),
    }
    const redisClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce('OK'),
      eval: vi.fn().mockResolvedValue(1),
    }
    const redisService = {
      getClient: () => redisClient,
      isReady: () => true,
    }
    const service = new CompanionMomentService(
      recentlyService as any,
      redisService as any,
      {
        get: vi.fn().mockResolvedValue({ webUrl: 'https://example.com/' }),
      } as any,
    )

    await expect(service.publish(principal, request)).resolves.toEqual({
      id: '123456789',
      createdAt: '2026-07-16T12:00:00.100Z',
      url: 'https://example.com/thinking/123456789',
    })
    expect(recentlyService.create).toHaveBeenCalledWith({
      content: request.data.content,
      metadata: {
        kind: 'companion-moment',
        schemaVersion: 1,
        observedAt: request.meta.observedAt,
        application: request.data.application,
        media: null,
      },
    })
    expect(recentlyService.create.mock.calls[0]?.[0]).not.toHaveProperty(
      'deviceId',
    )
  })

  it('replays a completed request without creating another Recently row', async () => {
    const cached = {
      id: '123456789',
      createdAt: '2026-07-16T12:00:00.100Z',
      url: 'https://example.com/thinking/123456789',
    }
    const recentlyService = { create: vi.fn() }
    const redisService = {
      getClient: () => ({
        get: vi.fn().mockResolvedValue(JSON.stringify(cached)),
      }),
      isReady: () => true,
    }
    const service = new CompanionMomentService(
      recentlyService as any,
      redisService as any,
      { get: vi.fn() } as any,
    )

    await expect(service.publish(principal, request)).resolves.toEqual(cached)
    expect(recentlyService.create).not.toHaveBeenCalled()
  })
})

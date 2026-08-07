import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import type { ConfigsService } from '~/modules/configs/configs.service'
import type { PushRepository } from '~/modules/push/push.repository'
import { PushService } from '~/modules/push/push.service'
import {
  configuredPushRelayOrigins,
  resolveAllowedPushRelayOrigin,
} from '~/modules/push/push-relay-origin'
import type { EventManagerService } from '~/processors/helper/helper.event.service'

describe('PushService', () => {
  let handler:
    ((event: BusinessEvents, data: any, scope: EventScope) => void) | undefined
  const repository = {
    listEnabledSources: vi.fn(),
    enqueueDelivery: vi.fn(),
    claimDueDeliveries: vi.fn(),
    findActiveBinding: vi.fn(),
    findLatestSourceForOwner: vi.fn(),
  }
  const configs = { get: vi.fn() }
  const events = {
    registerHandler: vi.fn((next) => {
      handler = next
      return vi.fn()
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    handler = undefined
    repository.listEnabledSources.mockResolvedValue([
      {
        id: 'local-source',
        relayUrl: 'https://push.example.com',
        remoteSourceId: 'remote-source',
        sourceSecret: 'encrypted',
        eventEndpoint: 'https://push.example.com/v1/webhooks/mx-core',
        enabled: true,
      },
    ])
    repository.enqueueDelivery.mockResolvedValue('delivery-1')
    repository.claimDueDeliveries.mockResolvedValue([])
  })

  it('projects a post-spam admin comment event without visitor fields', async () => {
    const service = new PushService(
      repository as unknown as PushRepository,
      configs as unknown as ConfigsService,
      events as unknown as EventManagerService,
    )
    service.onModuleInit()
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      {
        id: '123',
        createdAt: new Date('2026-08-07T12:00:00.000Z'),
        author: 'Visitor',
        mail: 'visitor@example.com',
        text: 'private body',
        ip: '192.0.2.1',
      },
      EventScope.TO_SYSTEM_ADMIN,
    )

    await vi.waitFor(() =>
      expect(repository.enqueueDelivery).toHaveBeenCalledOnce(),
    )
    const event = repository.enqueueDelivery.mock.calls[0]![0].event
    expect(event).toMatchObject({
      id: 'comment.created:123',
      type: 'dev.mx-space.comment.created.v1',
      subject: 'comment/123',
      data: { resource_id: '123', resource_type: 'comment' },
    })
    expect(Object.keys(event.data)).toEqual(['resource_id', 'resource_type'])
    expect(JSON.stringify(event)).not.toContain('private body')
    service.onModuleDestroy()
  })

  it('ignores visitor-only broadcasts and owner replies', async () => {
    const service = new PushService(
      repository as unknown as PushRepository,
      configs as unknown as ConfigsService,
      events as unknown as EventManagerService,
    )
    service.onModuleInit()
    handler?.(BusinessEvents.COMMENT_CREATE, { id: '1' }, EventScope.TO_VISITOR)
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      { id: '2', isOwnerReply: true },
      EventScope.TO_SYSTEM_ADMIN,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repository.enqueueDelivery).not.toHaveBeenCalled()
  })

  it('keeps relay configuration visible after the active binding is revoked', async () => {
    repository.findActiveBinding.mockResolvedValue(null)
    repository.findLatestSourceForOwner.mockResolvedValue({
      relayUrl: 'https://push.example.com',
    })
    const service = new PushService(
      repository as unknown as PushRepository,
      configs as unknown as ConfigsService,
      events as unknown as EventManagerService,
    )

    await expect(service.status('owner-1')).resolves.toEqual({
      configured: true,
      enabled: false,
      relayUrl: 'https://push.example.com',
      bindingId: null,
    })
  })
})

describe('Push Relay origin policy', () => {
  it('returns the configured origin instead of the request value', () => {
    const env = {
      NODE_ENV: 'production',
      MX_PUSH_RELAY_ORIGINS:
        'https://push.example.com, https://push-backup.example.com',
    }

    expect(resolveAllowedPushRelayOrigin('https://push.example.com', env)).toBe(
      'https://push.example.com',
    )
    expect(configuredPushRelayOrigins(env)).toEqual([
      'https://push.example.com',
      'https://push-backup.example.com',
    ])
  })

  it('rejects unconfigured and insecure production destinations', () => {
    const env = {
      NODE_ENV: 'production',
      MX_PUSH_RELAY_ORIGINS: 'https://push.example.com',
    }

    expect(() =>
      resolveAllowedPushRelayOrigin('https://metadata.example.net', env),
    ).toThrow('Push Relay origin is not allowed')
    expect(() =>
      resolveAllowedPushRelayOrigin('http://127.0.0.1:8787', env),
    ).toThrow('Push Relay origins must use HTTPS in production')
  })

  it('provides explicit loopback defaults only outside production', () => {
    expect(configuredPushRelayOrigins({ NODE_ENV: 'production' })).toEqual([])
    expect(configuredPushRelayOrigins({ NODE_ENV: 'development' })).toContain(
      'http://localhost:8787',
    )
  })
})

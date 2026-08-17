import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
} from '@mx-space/push-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import type { CommentRepository } from '~/modules/comment/comment.repository'
import type { ConfigsService } from '~/modules/configs/configs.service'
import type { PushRepository } from '~/modules/push/push.repository'
import { PushService } from '~/modules/push/push.service'
import {
  configuredPushRelayOrigins,
  resolveAllowedPushRelayOrigin,
} from '~/modules/push/push-relay-origin'
import { PushSecretVault } from '~/modules/push/push-secret.vault'
import type { EventManagerService } from '~/processors/helper/helper.event.service'

const defaultPreferences = {
  contentPost: true,
  contentNote: true,
  contentRecently: true,
  commentReplied: true,
}

describe('PushService', () => {
  let handler:
    ((event: BusinessEvents, data: any, scope: EventScope) => void) | undefined
  const repository = {
    listEnabledSources: vi.fn(),
    enqueueDelivery: vi.fn(),
    claimDueDeliveries: vi.fn(),
    findActiveBinding: vi.fn(),
    findLatestSourceForReader: vi.fn(),
    findSourceByRelayUrl: vi.fn(),
    saveActivation: vi.fn(),
    getOrDefaultPreferences: vi.fn(),
    upsertPreferences: vi.fn(),
    listActiveBindingsForReader: vi.fn(),
    findOwnedActiveBinding: vi.fn(),
    revokeBinding: vi.fn(),
  }
  const configs = { get: vi.fn() }
  const events = {
    registerHandler: vi.fn((next) => {
      handler = next
      return vi.fn()
    }),
  }
  const commentRepository = {
    findById: vi.fn(),
  }
  const originalRelayOrigins = process.env.MX_PUSH_RELAY_ORIGINS

  const createService = () =>
    new PushService(
      repository as unknown as PushRepository,
      configs as unknown as ConfigsService,
      events as unknown as EventManagerService,
      commentRepository as unknown as CommentRepository,
    )

  const flushHandler = async () => {
    await vi.waitFor(() =>
      expect(repository.enqueueDelivery.mock.calls.length).toBeGreaterThan(0),
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    handler = undefined
    process.env.MX_PUSH_RELAY_ORIGINS = 'https://push.example.com'
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
    repository.getOrDefaultPreferences.mockResolvedValue(defaultPreferences)
    repository.upsertPreferences.mockImplementation(
      async (_readerId: string, prefs: typeof defaultPreferences) => prefs,
    )
    repository.listActiveBindingsForReader.mockResolvedValue([])
    commentRepository.findById.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalRelayOrigins === undefined) {
      delete process.env.MX_PUSH_RELAY_ORIGINS
    } else {
      process.env.MX_PUSH_RELAY_ORIGINS = originalRelayOrigins
    }
  })

  it('projects a post-spam admin comment event without visitor fields', async () => {
    const service = createService()
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
      type: COMMENT_CREATED_EVENT,
      subject: 'comment/123',
      data: { resource_id: '123', resource_type: 'comment' },
    })
    expect(Object.keys(event.data)).toEqual(['resource_id', 'resource_type'])
    expect(JSON.stringify(event)).not.toContain('private body')
    service.onModuleDestroy()
  })

  it('ignores visitor-only broadcasts and owner replies for admin comment.created', async () => {
    const service = createService()
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

  it.each([
    {
      event: BusinessEvents.POST_CREATE,
      payload: { id: 'post-1', title: 'Secret title', text: 'private body' },
      resourceType: 'post',
    },
    {
      event: BusinessEvents.NOTE_CREATE,
      payload: { id: 'note-1', title: 'Secret note', text: 'private body' },
      resourceType: 'note',
    },
    {
      event: BusinessEvents.RECENTLY_CREATE,
      payload: {
        id: 'recently-1',
        content: 'private recently body',
        title: 'Secret recently',
      },
      resourceType: 'recently',
    },
  ] as const)(
    'projects a public $resourceType publish without private fields',
    async ({ event: businessEvent, payload, resourceType }) => {
      const service = createService()
      service.onModuleInit()
      handler?.(businessEvent, payload, EventScope.TO_SYSTEM_VISITOR)

      await flushHandler()
      const event = repository.enqueueDelivery.mock.calls[0]![0].event
      expect(event).toMatchObject({
        id: `content.published:${resourceType}:${payload.id}`,
        type: CONTENT_PUBLISHED_EVENT,
        subject: `${resourceType}/${payload.id}`,
        data: { resource_id: payload.id, resource_type: resourceType },
      })
      expect(Object.keys(event.data)).toEqual(['resource_id', 'resource_type'])
      expect(JSON.stringify(event)).not.toContain('private')
      expect(JSON.stringify(event)).not.toContain('Secret')
      service.onModuleDestroy()
    },
  )

  it('does not publish content events without a visitor scope', async () => {
    const service = createService()
    service.onModuleInit()
    handler?.(
      BusinessEvents.POST_CREATE,
      { id: 'post-hidden' },
      EventScope.TO_SYSTEM_ADMIN,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repository.enqueueDelivery).not.toHaveBeenCalled()
  })

  it('emits comment.replied for a visitor-scope reply to a different reader', async () => {
    commentRepository.findById.mockResolvedValue({
      id: 'parent-1',
      readerId: 'reader-parent',
    })
    const service = createService()
    service.onModuleInit()
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      {
        id: '456',
        parentCommentId: 'parent-1',
        readerId: 'reader-child',
        text: 'private reply',
        createdAt: new Date('2026-08-07T12:00:00.000Z'),
      },
      EventScope.TO_VISITOR,
    )

    await flushHandler()
    expect(commentRepository.findById).toHaveBeenCalledWith('parent-1')
    const event = repository.enqueueDelivery.mock.calls[0]![0].event
    expect(event).toMatchObject({
      id: 'comment.replied:456',
      type: COMMENT_REPLIED_EVENT,
      subject: 'comment/456',
      data: {
        resource_id: '456',
        resource_type: 'comment',
        recipient_reader_id: 'reader-parent',
      },
    })
    expect(JSON.stringify(event)).not.toContain('private reply')
    service.onModuleDestroy()
  })

  it('skips reply events for self-replies, guest parents, missing parents, and roots', async () => {
    const service = createService()
    service.onModuleInit()

    commentRepository.findById.mockResolvedValue({
      id: 'parent-self',
      readerId: 'reader-1',
    })
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      { id: 'self', parentCommentId: 'parent-self', readerId: 'reader-1' },
      EventScope.TO_VISITOR,
    )

    commentRepository.findById.mockResolvedValue({
      id: 'parent-guest',
      readerId: null,
    })
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      { id: 'guest', parentCommentId: 'parent-guest', readerId: 'reader-1' },
      EventScope.TO_VISITOR,
    )

    commentRepository.findById.mockResolvedValue(null)
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      {
        id: 'missing',
        parentCommentId: 'missing-parent',
        readerId: 'reader-1',
      },
      EventScope.TO_VISITOR,
    )

    handler?.(
      BusinessEvents.COMMENT_CREATE,
      { id: 'root', readerId: 'reader-1' },
      EventScope.TO_VISITOR,
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repository.enqueueDelivery).not.toHaveBeenCalled()
  })

  it('keeps admin comment.created when a reply is also broadcast to visitors', async () => {
    commentRepository.findById.mockResolvedValue({
      id: 'parent-1',
      readerId: 'reader-parent',
    })
    const service = createService()
    service.onModuleInit()
    const payload = {
      id: '789',
      parentCommentId: 'parent-1',
      readerId: 'reader-child',
      createdAt: new Date('2026-08-07T12:00:00.000Z'),
    }
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      payload,
      EventScope.TO_SYSTEM_ADMIN,
    )
    handler?.(BusinessEvents.COMMENT_CREATE, payload, EventScope.TO_VISITOR)

    await vi.waitFor(() =>
      expect(repository.enqueueDelivery).toHaveBeenCalledTimes(2),
    )
    const types = repository.enqueueDelivery.mock.calls.map(
      (call) => call[0].event.type,
    )
    expect(types).toEqual([COMMENT_CREATED_EVENT, COMMENT_REPLIED_EVENT])
    service.onModuleDestroy()
  })

  it('does not emit a duplicate reply when the same visitor-inclusive broadcast also targets admin', async () => {
    commentRepository.findById.mockResolvedValue({
      id: 'parent-1',
      readerId: 'reader-parent',
    })
    const service = createService()
    service.onModuleInit()
    handler?.(
      BusinessEvents.COMMENT_CREATE,
      {
        id: '790',
        parentCommentId: 'parent-1',
        readerId: 'reader-child',
        createdAt: new Date('2026-08-07T12:00:00.000Z'),
      },
      EventScope.ALL,
    )

    await vi.waitFor(() =>
      expect(repository.enqueueDelivery).toHaveBeenCalledTimes(2),
    )
    const replied = repository.enqueueDelivery.mock.calls.filter(
      (call) => call[0].event.type === COMMENT_REPLIED_EVENT,
    )
    expect(replied).toHaveLength(1)
    service.onModuleDestroy()
  })

  it('keeps relay configuration visible after the active binding is revoked', async () => {
    repository.findActiveBinding.mockResolvedValue(null)
    repository.findLatestSourceForReader.mockResolvedValue({
      relayUrl: 'https://push.example.com',
    })
    const service = createService()

    await expect(service.status('reader-1')).resolves.toEqual({
      configured: true,
      enabled: false,
      relayUrl: 'https://push.example.com',
      bindingId: null,
    })
  })

  it('returns default preferences without requiring a stored row', async () => {
    const service = createService()
    await expect(service.getPreferences('reader-1')).resolves.toEqual(
      defaultPreferences,
    )
    expect(repository.getOrDefaultPreferences).toHaveBeenCalledWith('reader-1')
  })

  it('sends reader_id and snake_case preferences on activation claim', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source_id: 'src_remote',
        source_secret: 's'.repeat(32),
        binding_id: 'bnd_remote',
        installation_id: 'inst_1',
        event_endpoint: 'https://push.example.com/v1/webhooks/mx-core',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    repository.findSourceByRelayUrl.mockResolvedValue(null)
    repository.getOrDefaultPreferences.mockResolvedValue({
      contentPost: false,
      contentNote: true,
      contentRecently: true,
      commentReplied: false,
    })
    repository.saveActivation.mockResolvedValue({ id: 'bnd_local' })
    configs.get.mockResolvedValue({
      serverUrl: 'https://core.example.com',
      webUrl: 'https://web.example.com',
    })

    const service = createService()
    await expect(
      service.activate('reader-1', {
        relayUrl: 'https://push.example.com',
        activationTicket: 't'.repeat(32),
      }),
    ).resolves.toEqual({
      enabled: true,
      relayUrl: 'https://push.example.com',
      bindingId: 'bnd_local',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(String(init.body))).toEqual({
      ticket: 't'.repeat(32),
      source_origin: 'https://core.example.com',
      source_label: 'core.example.com',
      reader_id: 'reader-1',
      preferences: {
        content_post: false,
        content_note: true,
        content_recently: true,
        comment_replied: false,
      },
    })
    expect(repository.saveActivation).toHaveBeenCalledWith(
      expect.objectContaining({ readerId: 'reader-1' }),
    )
  })

  it('persists preferences first and surfaces a remote partial failure without rolling back', async () => {
    const sourceSecret = PushSecretVault.encrypt('srcsec_private')
    repository.listActiveBindingsForReader.mockResolvedValue([
      {
        id: 'bnd-1',
        remoteBindingId: 'remote-1',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
      {
        id: 'bnd-2',
        remoteBindingId: 'remote-2',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
    ])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: true }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchMock)

    const service = createService()
    await expect(
      service.updatePreferences('reader-1', { contentPost: false }),
    ).rejects.toThrow(/preferences/i)

    expect(repository.upsertPreferences).toHaveBeenCalledWith('reader-1', {
      contentPost: false,
      contentNote: true,
      contentRecently: true,
      commentReplied: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://push.example.com/v1/bindings/remote-1/preferences',
    )
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({
      content_post: false,
      content_note: true,
      content_recently: true,
      comment_replied: true,
    })
    expect(repository.upsertPreferences).toHaveBeenCalledOnce()
  })

  it('aggregates every failed binding id and reason while still attempting the successful one', async () => {
    const sourceSecret = PushSecretVault.encrypt('srcsec_private')
    repository.listActiveBindingsForReader.mockResolvedValue([
      {
        id: 'bnd-ok',
        remoteBindingId: 'remote-ok',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
      {
        id: 'bnd-fail-a',
        remoteBindingId: 'remote-a',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
      {
        id: 'bnd-fail-b',
        remoteBindingId: 'remote-b',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
    ])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updated: true }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error('relay timeout'))
    vi.stubGlobal('fetch', fetchMock)

    const service = createService()
    const error = await service
      .updatePreferences('reader-1', { commentReplied: false })
      .then(
        () => {
          throw new Error('expected updatePreferences to reject')
        },
        (reason: unknown) => reason,
      )
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('bnd-fail-a')
    expect((error as Error).message).toContain('HTTP 500')
    expect((error as Error).message).toContain('bnd-fail-b')
    expect((error as Error).message).toContain('relay timeout')

    expect(repository.upsertPreferences).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('remote-ok')
    expect(String(fetchMock.mock.calls[1]![0])).toContain('remote-a')
    expect(String(fetchMock.mock.calls[2]![0])).toContain('remote-b')
  })

  it('synchronizes every active binding and returns the stored preferences', async () => {
    const sourceSecret = PushSecretVault.encrypt('srcsec_private')
    repository.listActiveBindingsForReader.mockResolvedValue([
      {
        id: 'bnd-1',
        remoteBindingId: 'remote-1',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
      {
        id: 'bnd-2',
        remoteBindingId: 'remote-2',
        source: {
          relayUrl: 'https://push.example.com',
          remoteSourceId: 'src-1',
          sourceSecret,
        },
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ updated: true }) }),
    )

    const service = createService()
    await expect(
      service.updatePreferences('reader-1', {
        contentPost: false,
        contentNote: false,
        contentRecently: true,
        commentReplied: true,
      }),
    ).resolves.toEqual({
      contentPost: false,
      contentNote: false,
      contentRecently: true,
      commentReplied: true,
    })
    expect(repository.listActiveBindingsForReader).toHaveBeenCalledWith(
      'reader-1',
    )
  })

  it('deactivates only the requested owned binding in a multi-device setup', async () => {
    const sourceSecret = PushSecretVault.encrypt('srcsec_private')
    repository.findActiveBinding.mockResolvedValue({
      id: 'bnd-latest',
      remoteBindingId: 'remote-latest',
      source: {
        relayUrl: 'https://push.example.com',
        remoteSourceId: 'src-1',
        sourceSecret,
      },
    })
    repository.findOwnedActiveBinding.mockResolvedValue({
      id: 'bnd-older',
      remoteBindingId: 'remote-older',
      source: {
        relayUrl: 'https://push.example.com',
        remoteSourceId: 'src-1',
        sourceSecret,
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const service = createService()
    await service.deactivate('reader-1', 'bnd-older')

    expect(repository.findOwnedActiveBinding).toHaveBeenCalledWith(
      'reader-1',
      'bnd-older',
    )
    expect(String(fetchMock.mock.calls[0]![0])).toContain('remote-older')
    expect(repository.revokeBinding).toHaveBeenCalledWith(
      'reader-1',
      'bnd-older',
    )
  })

  it('ignores deactivation of a binding owned by another reader', async () => {
    repository.findOwnedActiveBinding.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const service = createService()
    await service.deactivate('reader-1', 'bnd-foreign')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(repository.revokeBinding).not.toHaveBeenCalled()
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

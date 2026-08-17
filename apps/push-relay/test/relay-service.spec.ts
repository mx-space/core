import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
  DEFAULT_PUSH_PREFERENCES,
  signPushRequest,
} from '@mx-space/push-protocol'
import { describe, expect, it, vi } from 'vitest'

import { buildApnsPayload, Http2ApnsProvider } from '../src/apns-provider.js'
import { credentialHash, DataVault } from '../src/crypto.js'
import { PushRelayService } from '../src/relay-service.js'
import type { PushRelayStore } from '../src/types.js'

const dataKey = '11'.repeat(32)

describe('PushRelayService', () => {
  it('binds a one-time installation and accepts an idempotent signed private event', async () => {
    const installations = new Map<string, any>()
    const sources = new Map<string, any>()
    let ticket: {
      hash: string
      installationId: string
      claimed: boolean
    } | null = null
    const accepted: unknown[] = []
    const store = {
      createInstallation: vi.fn(async (input) =>
        installations.set(input.id, {
          id: input.id,
          appId: input.appId,
          apnsEnvironment: input.apnsEnvironment,
          tokenCiphertext: input.tokenCiphertext,
          secretHash: input.secretHash,
          revokedAt: null,
        }),
      ),
      findInstallation: vi.fn(async (id) => installations.get(id) ?? null),
      updateInstallationToken: vi.fn(),
      createActivationTicket: vi.fn(async (input) => {
        ticket = {
          hash: input.ticketHash,
          installationId: input.installationId,
          claimed: false,
        }
      }),
      claimActivationTicket: vi.fn(async (hash, now) => {
        if (!ticket || ticket.hash !== hash || ticket.claimed) return null
        ticket.claimed = true
        return {
          installationId: ticket.installationId,
          expiresAt: new Date(now.getTime() + 1),
          claimedAt: now,
        }
      }),
      createSource: vi.fn(async (input) =>
        sources.set(input.id, {
          id: input.id,
          secretCiphertext: input.secretCiphertext,
          origin: input.origin,
          revokedAt: null,
        }),
      ),
      findSource: vi.fn(async (id) => sources.get(id) ?? null),
      createBinding: vi.fn(async (input) => input.id),
      revokeBinding: vi.fn(),
      acceptEvent: vi.fn(async (input) => {
        accepted.push(input.event)
        return { accepted: accepted.length === 1, deliveries: 1 }
      }),
      claimDeliveries: vi.fn(),
      completeDelivery: vi.fn(),
      retryDelivery: vi.fn(),
      failDelivery: vi.fn(),
      revokeInstallation: vi.fn(),
    } as unknown as PushRelayStore
    const service = new PushRelayService(store, {
      publicUrl: 'https://push.example.com',
      dataKey,
      apps: new Map([
        [
          'space',
          {
            id: 'space',
            bundleId: 'dev.innei.space',
            teamId: 'TEAM',
            keys: {
              development: {
                keyId: 'KEY',
                privateKeyPath: '/unused',
                privateKey: 'unused',
              },
            },
          },
        ],
      ]),
    })

    const installation = await service.registerInstallation({
      app_id: 'space',
      apns_environment: 'development',
      apns_token: 'ab'.repeat(32),
    })
    const ticketResult = await service.createActivationTicket(
      `Installation ${installation.installation_id}.${installation.installation_secret}`,
      new Date('2026-08-07T12:00:00.000Z'),
    )
    const claim = await service.claimSourceActivation(undefined, {
      ticket: ticketResult.ticket,
      source_origin: 'https://core.example.com',
    })
    expect(claim.installation_id).toBe(installation.installation_id)
    expect(claim.source_secret).toMatch(/^srcsec_/)
    expect(store.createBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        readerId: null,
        preferences: DEFAULT_PUSH_PREFERENCES,
      }),
    )

    const event = {
      specversion: '1.0',
      id: 'comment.created:123',
      source: `urn:mx-core:instance:${claim.source_id}`,
      type: COMMENT_CREATED_EVENT,
      subject: 'comment/123',
      time: '2026-08-07T12:00:00.000Z',
      datacontenttype: 'application/json',
      data: { resource_id: '123', resource_type: 'comment' },
    } as const
    const rawBody = Buffer.from(JSON.stringify(event))
    const timestamp = String(new Date('2026-08-07T12:00:01.000Z').getTime())
    const deliveryId = 'dlv-1'
    const signature = signPushRequest({
      secret: claim.source_secret!,
      timestamp,
      deliveryId,
      rawBody,
    })
    const result = await service.acceptEvent({
      rawBody,
      sourceId: claim.source_id,
      deliveryId,
      timestamp,
      signature,
      now: new Date('2026-08-07T12:00:01.000Z'),
    })

    expect(result).toEqual({
      accepted: true,
      event_id: event.id,
      deliveries: 1,
    })
    expect(accepted).toEqual([event])
  })

  it('builds a generic APNs alert without visitor content', () => {
    const payload = buildApnsPayload({
      specversion: '1.0',
      id: 'comment.created:123',
      source: 'urn:mx-core:instance:src-1',
      type: COMMENT_CREATED_EVENT,
      subject: 'comment/123',
      time: '2026-08-07T12:00:00.000Z',
      datacontenttype: 'application/json',
      data: { resource_id: '123', resource_type: 'comment' },
    })
    expect(payload).toEqual({
      aps: {
        alert: {
          title: 'New comment',
          body: 'A new comment is ready to review.',
        },
        sound: 'default',
        'thread-id': 'comments',
        category: 'SPACE_COMMENT',
      },
      schema_version: 1,
      source_id: 'src-1',
      resource_type: 'comment',
      resource_id: '123',
    })
    expect(JSON.stringify(payload)).not.toMatch(/author|email|text|ip/i)
  })

  it('rejects delivery when the device environment has no matching APNs key', async () => {
    const provider = new Http2ApnsProvider(
      new Map([
        [
          'space',
          {
            id: 'space',
            bundleId: 'dev.innei.space',
            teamId: 'TEAM',
            keys: {
              production: {
                keyId: 'PRODUCTION_KEY',
                privateKeyPath: '/unused',
                privateKey: 'unused',
              },
            },
          },
        ],
      ]),
    )

    await expect(
      provider.send({
        appId: 'space',
        environment: 'development',
        deviceToken: 'ab'.repeat(32),
        event: {
          specversion: '1.0',
          id: 'comment.created:environment-mismatch',
          source: 'urn:mx-core:instance:src-1',
          type: COMMENT_CREATED_EVENT,
          subject: 'comment/environment-mismatch',
          time: '2026-08-09T00:00:00.000Z',
          datacontenttype: 'application/json',
          data: {
            resource_id: 'environment-mismatch',
            resource_type: 'comment',
          },
        },
      }),
    ).resolves.toEqual({
      status: 400,
      apnsId: null,
      reason: 'MissingEnvironmentKey',
    })
  })

  it('refuses to update a different installation with valid credentials', async () => {
    const store = {
      findInstallation: vi.fn(async () => ({
        id: 'ins-owned',
        secretHash: credentialHash('inssec-owned'),
        revokedAt: null,
      })),
      updateInstallationToken: vi.fn(),
    } as unknown as PushRelayStore
    const service = new PushRelayService(store, {
      publicUrl: 'https://push.example.com',
      dataKey,
      apps: new Map(),
    })

    await expect(
      service.updateInstallationToken(
        'ins-other',
        'Installation ins-owned.inssec-owned',
        {
          apns_environment: 'development',
          apns_token: 'ab'.repeat(32),
        },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'installation_mismatch' })
    expect(store.updateInstallationToken).not.toHaveBeenCalled()
  })

  it('encrypts Relay secrets with authenticated encryption', () => {
    const vault = new DataVault(dataKey)
    const encrypted = vault.encrypt('secret')
    expect(encrypted).not.toContain('secret')
    expect(vault.decrypt(encrypted)).toBe('secret')
    expect(() => vault.decrypt(`${encrypted.slice(0, -1)}x`)).toThrow()
  })
})

const yohakuApps = new Map([
  [
    'yohaku',
    {
      id: 'yohaku',
      bundleId: 'app.example.yohaku',
      teamId: 'TEAM',
      keys: {
        development: {
          keyId: 'KEY',
          privateKeyPath: '/unused',
          privateKey: 'unused',
        },
      },
    },
  ],
]) as ConstructorParameters<typeof PushRelayService>[1]['apps']

const spaceClaimBody = {
  ticket: '',
  source_origin: 'https://core.example.com',
}

const allOnPreferences = {
  content_post: true,
  content_note: true,
  content_recently: true,
  comment_replied: true,
}

const mixedPreferences = {
  content_post: false,
  content_note: true,
  content_recently: true,
  comment_replied: false,
}

const createClaimHarness = () => {
  const installations = new Map<string, any>()
  const sources = new Map<string, any>()
  const tickets = new Map<
    string,
    { installationId: string; claimed: boolean }
  >()
  const bindings: Array<Record<string, unknown>> = []
  const store = {
    createInstallation: vi.fn(async (input) =>
      installations.set(input.id, {
        id: input.id,
        appId: input.appId,
        apnsEnvironment: input.apnsEnvironment,
        tokenCiphertext: input.tokenCiphertext,
        secretHash: input.secretHash,
        revokedAt: null,
      }),
    ),
    findInstallation: vi.fn(async (id) => installations.get(id) ?? null),
    updateInstallationToken: vi.fn(),
    createActivationTicket: vi.fn(async (input) => {
      tickets.set(input.ticketHash, {
        installationId: input.installationId,
        claimed: false,
      })
    }),
    claimActivationTicket: vi.fn(async (hash, now) => {
      const ticket = tickets.get(hash)
      if (!ticket || ticket.claimed) return null
      ticket.claimed = true
      return {
        installationId: ticket.installationId,
        expiresAt: new Date(now.getTime() + 1),
        claimedAt: now,
      }
    }),
    createSource: vi.fn(async (input) =>
      sources.set(input.id, {
        id: input.id,
        secretCiphertext: input.secretCiphertext,
        origin: input.origin,
        revokedAt: null,
      }),
    ),
    findSource: vi.fn(async (id) => sources.get(id) ?? null),
    createBinding: vi.fn(async (input) => {
      bindings.push(input)
      return input.id
    }),
    revokeBinding: vi.fn(),
    updateBindingPreferences: vi.fn(),
    acceptEvent: vi.fn(),
    claimDeliveries: vi.fn(),
    completeDelivery: vi.fn(),
    retryDelivery: vi.fn(),
    failDelivery: vi.fn(),
    revokeInstallation: vi.fn(),
  } as unknown as PushRelayStore
  const service = new PushRelayService(store, {
    publicUrl: 'https://push.example.com',
    dataKey,
    apps: yohakuApps,
  })
  return { service, store, bindings }
}

describe('claimSourceActivation reader metadata', () => {
  it('persists Yohaku reader_id and preferences from the claim body', async () => {
    const { service, store } = createClaimHarness()
    const installation = await service.registerInstallation({
      app_id: 'yohaku',
      apns_environment: 'development',
      apns_token: 'ab'.repeat(32),
    })
    const ticketResult = await service.createActivationTicket(
      `Installation ${installation.installation_id}.${installation.installation_secret}`,
    )
    const claim = await service.claimSourceActivation(undefined, {
      ticket: ticketResult.ticket,
      source_origin: spaceClaimBody.source_origin,
      reader_id: 'reader_1',
      preferences: mixedPreferences,
    })

    expect(claim.binding_id).toMatch(/^bnd_/)
    expect(store.createBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: installation.installation_id,
        readerId: 'reader_1',
        preferences: mixedPreferences,
      }),
    )
  })

  it('defaults omitted Yohaku preferences to DEFAULT_PUSH_PREFERENCES', async () => {
    const { service, store } = createClaimHarness()
    const installation = await service.registerInstallation({
      app_id: 'yohaku',
      apns_environment: 'development',
      apns_token: 'cd'.repeat(32),
    })
    const ticketResult = await service.createActivationTicket(
      `Installation ${installation.installation_id}.${installation.installation_secret}`,
    )
    await service.claimSourceActivation(undefined, {
      ticket: ticketResult.ticket,
      source_origin: spaceClaimBody.source_origin,
      reader_id: 'reader_2',
    })

    expect(store.createBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        readerId: 'reader_2',
        preferences: DEFAULT_PUSH_PREFERENCES,
      }),
    )
  })

  it('updates metadata when the same source reclaims an installation', async () => {
    const { service, store } = createClaimHarness()
    const installation = await service.registerInstallation({
      app_id: 'yohaku',
      apns_environment: 'development',
      apns_token: 'ef'.repeat(32),
    })
    const firstTicket = await service.createActivationTicket(
      `Installation ${installation.installation_id}.${installation.installation_secret}`,
    )
    const firstClaim = await service.claimSourceActivation(undefined, {
      ticket: firstTicket.ticket,
      source_origin: spaceClaimBody.source_origin,
      reader_id: 'reader_1',
      preferences: allOnPreferences,
    })
    const secondTicket = await service.createActivationTicket(
      `Installation ${installation.installation_id}.${installation.installation_secret}`,
    )
    await service.claimSourceActivation(
      `Source ${firstClaim.source_id}.${firstClaim.source_secret}`,
      {
        ticket: secondTicket.ticket,
        source_origin: spaceClaimBody.source_origin,
        reader_id: 'reader_1',
        preferences: mixedPreferences,
      },
    )

    expect(store.createBinding).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sourceId: firstClaim.source_id,
        installationId: installation.installation_id,
        readerId: 'reader_1',
        preferences: mixedPreferences,
      }),
    )
  })
})

describe('device-owned bindings', () => {
  const vault = new DataVault(dataKey)
  const preferences = mixedPreferences

  type StoredBinding = {
    id: string
    sourceId: string
    installationId: string
    readerId: string | null
    preferences: typeof preferences
    revokedAt: Date | null
  }

  const createDeviceHarness = () => {
    const installations = new Map<string, any>()
    const bindings = new Map<string, StoredBinding>()
    for (const id of ['ins-owned', 'ins-other']) {
      installations.set(id, {
        id,
        appId: 'yohaku',
        apnsEnvironment: 'development',
        tokenCiphertext: 'cipher',
        secretHash: credentialHash(`inssec-${id}`),
        revokedAt: null,
      })
    }
    bindings.set('bnd-owned', {
      id: 'bnd-owned',
      sourceId: 'src-1',
      installationId: 'ins-owned',
      readerId: 'reader_1',
      preferences: allOnPreferences,
      revokedAt: null,
    })
    bindings.set('bnd-foreign', {
      id: 'bnd-foreign',
      sourceId: 'src-1',
      installationId: 'ins-other',
      readerId: 'reader_2',
      preferences: allOnPreferences,
      revokedAt: null,
    })
    bindings.set('bnd-revoked', {
      id: 'bnd-revoked',
      sourceId: 'src-1',
      installationId: 'ins-owned',
      readerId: 'reader_1',
      preferences: allOnPreferences,
      revokedAt: new Date('2026-08-17T00:00:00.000Z'),
    })

    const ownedBinding = (installationId: string, bindingId: string) => {
      const binding = bindings.get(bindingId)
      if (!binding || binding.installationId !== installationId) return null
      return binding
    }

    const store = {
      findInstallation: vi.fn(
        async (id: string) => installations.get(id) ?? null,
      ),
      findSource: vi.fn(async (id: string) =>
        id === 'src-owned'
          ? {
              id: 'src-owned',
              secretCiphertext: vault.encrypt('srcsec-owned'),
              origin: 'https://core.example.com',
              revokedAt: null,
            }
          : null,
      ),
      findBindingForInstallation: vi.fn(
        async (installationId: string, bindingId: string) => {
          const binding = ownedBinding(installationId, bindingId)
          return binding && !binding.revokedAt ? { ...binding } : null
        },
      ),
      updateBindingPreferencesForInstallation: vi.fn(
        async (input: {
          installationId: string
          bindingId: string
          preferences: typeof preferences
        }) => {
          const binding = ownedBinding(input.installationId, input.bindingId)
          if (!binding || binding.revokedAt) return false
          binding.preferences = input.preferences
          return true
        },
      ),
      revokeBindingForInstallation: vi.fn(
        async (installationId: string, bindingId: string, now: Date) => {
          const binding = ownedBinding(installationId, bindingId)
          if (!binding || binding.revokedAt) return false
          binding.revokedAt = now
          return true
        },
      ),
    } as unknown as PushRelayStore
    const service = new PushRelayService(store, {
      publicUrl: 'https://push.example.com',
      dataKey,
      apps: yohakuApps,
    })
    return { service, store, bindings }
  }

  const ownedAuthorization = 'Installation ins-owned.inssec-ins-owned'

  it('reads its own binding with installation credentials', async () => {
    const { service } = createDeviceHarness()

    await expect(
      service.getBinding(ownedAuthorization, 'bnd-owned'),
    ).resolves.toEqual({
      binding_id: 'bnd-owned',
      source_id: 'src-1',
      installation_id: 'ins-owned',
      reader_id: 'reader_1',
      preferences: allOnPreferences,
    })
  })

  it('returns 404 when reading a binding owned by another installation', async () => {
    const { service } = createDeviceHarness()

    await expect(
      service.getBinding(ownedAuthorization, 'bnd-foreign'),
    ).rejects.toMatchObject({ status: 404, code: 'binding_not_found' })
  })

  it('returns 404 when reading a revoked binding', async () => {
    const { service } = createDeviceHarness()

    await expect(
      service.getBinding(ownedAuthorization, 'bnd-revoked'),
    ).rejects.toMatchObject({ status: 404, code: 'binding_not_found' })
  })

  it('updates preferences on its own binding', async () => {
    const { service, store, bindings } = createDeviceHarness()

    await expect(
      service.updateBindingPreferences(
        ownedAuthorization,
        'bnd-owned',
        preferences,
      ),
    ).resolves.toEqual({
      updated: true,
      binding_id: 'bnd-owned',
      preferences,
    })
    expect(store.updateBindingPreferencesForInstallation).toHaveBeenCalledWith({
      installationId: 'ins-owned',
      bindingId: 'bnd-owned',
      preferences,
    })
    expect(bindings.get('bnd-owned')?.preferences).toEqual(preferences)
  })

  it('does not update preferences on another installation binding', async () => {
    const { service, bindings } = createDeviceHarness()

    await expect(
      service.updateBindingPreferences(
        ownedAuthorization,
        'bnd-foreign',
        preferences,
      ),
    ).rejects.toMatchObject({ status: 404, code: 'binding_not_found' })
    expect(bindings.get('bnd-foreign')?.preferences).toEqual(allOnPreferences)
  })

  it('does not update preferences on a revoked binding', async () => {
    const { service, bindings } = createDeviceHarness()

    await expect(
      service.updateBindingPreferences(
        ownedAuthorization,
        'bnd-revoked',
        preferences,
      ),
    ).rejects.toMatchObject({ status: 404, code: 'binding_not_found' })
    expect(bindings.get('bnd-revoked')?.preferences).toEqual(allOnPreferences)
  })

  it('rejects preference bodies that are not the strict protocol object', async () => {
    const { service, store } = createDeviceHarness()

    await expect(
      service.updateBindingPreferences(ownedAuthorization, 'bnd-owned', {
        content_post: true,
      }),
    ).rejects.toThrow()
    expect(store.updateBindingPreferencesForInstallation).not.toHaveBeenCalled()
  })

  it('revokes its own binding', async () => {
    const { service, store, bindings } = createDeviceHarness()
    const now = new Date('2026-08-17T12:00:00.000Z')

    await expect(
      service.revokeBinding(ownedAuthorization, 'bnd-owned', now),
    ).resolves.toEqual({ revoked: true })
    expect(store.revokeBindingForInstallation).toHaveBeenCalledWith(
      'ins-owned',
      'bnd-owned',
      now,
    )
    expect(bindings.get('bnd-owned')?.revokedAt).toEqual(now)
  })

  it('does not revoke another installation binding', async () => {
    const { service, bindings } = createDeviceHarness()

    await expect(
      service.revokeBinding(ownedAuthorization, 'bnd-foreign'),
    ).rejects.toMatchObject({ status: 404, code: 'binding_not_found' })
    expect(bindings.get('bnd-foreign')?.revokedAt).toBeNull()
  })

  it('refuses source credentials on device binding endpoints', async () => {
    const { service, store } = createDeviceHarness()
    const sourceAuthorization = 'Source src-owned.srcsec-owned'

    await expect(
      service.getBinding(sourceAuthorization, 'bnd-owned'),
    ).rejects.toMatchObject({ status: 401, code: 'installation_unauthorized' })
    await expect(
      service.updateBindingPreferences(
        sourceAuthorization,
        'bnd-owned',
        preferences,
      ),
    ).rejects.toMatchObject({ status: 401, code: 'installation_unauthorized' })
    await expect(
      service.revokeBinding(sourceAuthorization, 'bnd-owned'),
    ).rejects.toMatchObject({ status: 401, code: 'installation_unauthorized' })
    expect(store.findBindingForInstallation).not.toHaveBeenCalled()
    expect(store.updateBindingPreferencesForInstallation).not.toHaveBeenCalled()
    expect(store.revokeBindingForInstallation).not.toHaveBeenCalled()
  })

  it('refuses a revoked installation credential', async () => {
    const { service, store } = createDeviceHarness()
    ;(store.findInstallation as any).mockImplementation(async () => ({
      id: 'ins-owned',
      secretHash: credentialHash('inssec-ins-owned'),
      revokedAt: new Date('2026-08-16T00:00:00.000Z'),
    }))

    await expect(
      service.getBinding(ownedAuthorization, 'bnd-owned'),
    ).rejects.toMatchObject({ status: 401, code: 'installation_unauthorized' })
  })
})

describe('buildApnsPayload yohaku events', () => {
  it('projects published posts with localized standard copy and a target path', () => {
    const payload = buildApnsPayload({
      specversion: '1.0',
      id: 'content.published:post-1',
      source: 'urn:mx-core:instance:src-1',
      type: CONTENT_PUBLISHED_EVENT,
      subject: 'post/post-1',
      time: '2026-08-07T12:00:00.000Z',
      datacontenttype: 'application/json',
      data: {
        resource_id: 'post-1',
        resource_type: 'post',
        display_title: 'Public title',
        summary: 'Public summary.',
        target_path: '/posts/journal/public-title',
      },
    })
    expect(payload).toEqual({
      aps: {
        alert: {
          'title-loc-key': 'PUSH_CONTENT_TITLE',
          'title-loc-args': ['Public title'],
          'subtitle-loc-key': 'PUSH_CONTENT_POST_SUBTITLE',
          'loc-key': 'PUSH_CONTENT_SUMMARY',
          'loc-args': ['Public summary.'],
        },
        sound: 'default',
        'thread-id': 'posts',
        category: 'YOHAKU_CONTENT',
      },
      event_type: CONTENT_PUBLISHED_EVENT,
      schema_version: 1,
      source_id: 'src-1',
      resource_type: 'post',
      resource_id: 'post-1',
      target_path: '/posts/journal/public-title',
    })
  })

  it('projects published notes and thinkings with matching threads', () => {
    expect(
      buildApnsPayload({
        specversion: '1.0',
        id: 'content.published:note-1',
        source: 'urn:mx-core:instance:src-1',
        type: CONTENT_PUBLISHED_EVENT,
        subject: 'note/note-1',
        time: '2026-08-07T12:00:00.000Z',
        datacontenttype: 'application/json',
        data: {
          resource_id: 'note-1',
          resource_type: 'note',
          display_title: 'Public note',
          summary: 'Public summary.',
          target_path: '/notes/42',
        },
      }).aps,
    ).toMatchObject({
      alert: { 'subtitle-loc-key': 'PUSH_CONTENT_NOTE_SUBTITLE' },
      'thread-id': 'notes',
      category: 'YOHAKU_CONTENT',
    })
    expect(
      buildApnsPayload({
        specversion: '1.0',
        id: 'content.published:recently-1',
        source: 'urn:mx-core:instance:src-1',
        type: CONTENT_PUBLISHED_EVENT,
        subject: 'recently/recently-1',
        time: '2026-08-07T12:00:00.000Z',
        datacontenttype: 'application/json',
        data: {
          resource_id: 'recently-1',
          resource_type: 'recently',
          display_title: 'Thinking',
          summary: 'Public summary.',
          target_path: '/thinking/recently-1',
        },
      }).aps,
    ).toMatchObject({
      alert: { 'subtitle-loc-key': 'PUSH_CONTENT_RECENTLY_SUBTITLE' },
      'thread-id': 'recently',
      category: 'YOHAKU_CONTENT',
    })
  })

  it('projects comment replies as mutable communication notifications', () => {
    const payload = buildApnsPayload({
      specversion: '1.0',
      id: 'comment.replied:456',
      source: 'urn:mx-core:instance:src-1',
      type: COMMENT_REPLIED_EVENT,
      subject: 'comment/456',
      time: '2026-08-07T12:00:00.000Z',
      datacontenttype: 'application/json',
      data: {
        resource_id: '456',
        resource_type: 'comment',
        recipient_reader_id: 'reader_1',
        sender_id: 'reader_2',
        sender_name: 'A reader',
        sender_avatar_url: 'https://cdn.example.com/avatar.png',
        target_title: 'Public post',
        target_path: '/comments/post-1',
      },
    })
    expect(payload).toEqual({
      aps: {
        alert: {
          'title-loc-key': 'PUSH_REPLY_TITLE',
          'title-loc-args': ['A reader'],
          'loc-key': 'PUSH_REPLY_BODY',
          'loc-args': ['Public post'],
        },
        sound: 'default',
        'thread-id': 'comment-replies',
        category: 'YOHAKU_COMMENT_REPLIED',
        'mutable-content': 1,
      },
      event_type: COMMENT_REPLIED_EVENT,
      schema_version: 1,
      source_id: 'src-1',
      resource_type: 'comment',
      resource_id: '456',
      sender_id: 'reader_2',
      sender_name: 'A reader',
      sender_avatar_url: 'https://cdn.example.com/avatar.png',
      target_title: 'Public post',
      target_path: '/comments/post-1',
    })
    expect(JSON.stringify(payload)).not.toContain('recipient_reader_id')
    expect(JSON.stringify(payload)).not.toContain('reader_1')
  })
})

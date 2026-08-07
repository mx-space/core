import { COMMENT_CREATED_EVENT, signPushRequest } from '@mx-space/push-protocol'
import { describe, expect, it, vi } from 'vitest'

import { buildApnsPayload } from '../src/apns-provider.js'
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
            keyId: 'KEY',
            privateKeyPath: '/unused',
            privateKey: 'unused',
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
    expect(payload).toMatchObject({
      aps: { alert: { title: 'New comment' }, category: 'SPACE_COMMENT' },
      resource_type: 'comment',
      resource_id: '123',
    })
    expect(JSON.stringify(payload)).not.toMatch(/author|email|text|ip/i)
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

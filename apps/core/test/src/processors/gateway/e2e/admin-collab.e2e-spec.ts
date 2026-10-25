import { randomUUID } from 'node:crypto'

import { redisHelper } from 'test/helper/redis-mock.helper'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import {
  CollabRoomService,
  CollabWsEvents,
} from '~/modules/draft/collab-room.service'
import {
  collabAccessProvider,
  collabRelayProvider,
  CollabRoomWsHandler,
} from '~/modules/draft/collab-room.ws'
import { DraftService } from '~/modules/draft/draft.service'
import {
  type DocumentChange,
  DraftCrdtService,
} from '~/modules/draft/draft-crdt.service'

import {
  createGatewayApp,
  type GatewayTestApp,
  WsTestClient,
} from './gateway-e2e.harness'

vi.setConfig({ testTimeout: 15_000 })

const listeners = new Set<(change: DocumentChange) => void>()
const crdtStub = {
  onDocumentChanged: (listener: (change: DocumentChange) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
const draftStub = {
  documentIdOf: vi.fn(async () => 'doc-1'),
  exportCrdtFor: vi.fn(async () => ({
    documentId: 'doc-1',
    update: new Uint8Array([1]),
  })),
  importCrdt: vi.fn(
    async (_id: string, update: Uint8Array, origin?: string) => {
      for (const listener of listeners) {
        listener({ documentId: 'doc-1', origin, update })
      }
    },
  ),
}

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64')

describe('admin collab room over the gateway', () => {
  let testApp: GatewayTestApp

  beforeAll(async () => {
    const helper = await redisHelper
    const opts = helper.CacheService.getClient().options
    testApp = await createGatewayApp(
      { host: opts.host as string, port: opts.port as number },
      [
        CollabRoomService,
        CollabRoomWsHandler,
        collabRelayProvider,
        collabAccessProvider,
        { provide: DraftService, useValue: draftStub },
        { provide: DraftCrdtService, useValue: crdtStub },
      ],
    )
  })

  afterAll(async () => {
    await testApp.close()
  })

  const connect = async (key: string) => {
    testApp.authService.verifyApiKey.mockResolvedValueOnce({
      referenceId: key,
    })
    testApp.authService.isOwnerReaderId.mockResolvedValueOnce(true)
    const client = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { 'x-api-key': key },
    })
    await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
    return client
  }

  const request = async (
    client: WsTestClient,
    event: string,
    payload: unknown,
  ) => {
    const id = randomUUID()
    client.send(event, payload, id)
    return (await client.waitForAck(id)).payload as Record<string, unknown>
  }

  it('relays updates and presence to the other member and announces leaving', async () => {
    const alice = await connect('alice')
    const bob = await connect('bob')
    try {
      expect(
        await request(alice, CollabWsEvents.join, { draftId: 'd1' }),
      ).toMatchObject({
        data: { documentId: 'doc-1', update: b64([1]) },
        ok: true,
      })
      await request(bob, CollabWsEvents.join, { draftId: 'd1' })
      await alice.waitFor((e) => e.event === CollabWsEvents.peerJoined)

      expect(
        await request(alice, CollabWsEvents.update, {
          draftId: 'd1',
          update: b64([4, 2]),
        }),
      ).toEqual({ ok: true })
      const update = await bob.waitFor((e) => e.event === CollabWsEvents.update)
      expect(update.payload).toEqual({
        documentId: 'doc-1',
        update: b64([4, 2]),
      })
      await alice.assertNotDelivered((e) => e.event === CollabWsEvents.update)

      await request(bob, CollabWsEvents.presence, {
        draftId: 'd1',
        state: b64([9]),
      })
      const presence = await alice.waitFor(
        (e) => e.event === CollabWsEvents.presence,
      )
      expect(presence.payload).toEqual({ documentId: 'doc-1', state: b64([9]) })

      await alice.closeAndWait()
      const left = await bob.waitFor((e) => e.event === CollabWsEvents.peerLeft)
      expect(left.payload).toMatchObject({ documentId: 'doc-1' })
    } finally {
      await bob.closeAndWait()
    }
  })

  it('ignores collab frames from a socket that has not authenticated', async () => {
    testApp.authService.verifyApiKey.mockReturnValueOnce(
      new Promise(() => undefined) as never,
    )
    const stranger = await WsTestClient.connect(testApp.adminUrl(), {
      headers: { 'x-api-key': 'pending' },
    })
    try {
      draftStub.importCrdt.mockClear()
      draftStub.exportCrdtFor.mockClear()
      expect(
        await request(stranger, CollabWsEvents.join, { draftId: 'd1' }),
      ).toEqual({ code: 'NOT_AUTHENTICATED', ok: false })
      expect(
        await request(stranger, CollabWsEvents.update, {
          draftId: 'd1',
          update: b64([1]),
        }),
      ).toEqual({ code: 'NOT_AUTHENTICATED', ok: false })
      expect(draftStub.exportCrdtFor).not.toHaveBeenCalled()
      expect(draftStub.importCrdt).not.toHaveBeenCalled()
    } finally {
      await stranger.closeAndWait()
    }
  })
})

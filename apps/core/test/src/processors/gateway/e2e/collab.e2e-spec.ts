import { randomUUID } from 'node:crypto'

import { redisHelper } from 'test/helper/redis-mock.helper'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { CollabRepository } from '~/modules/draft/collab.repository'
import { CollabService } from '~/modules/draft/collab.service'
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
  onDocumentReset: () => () => undefined,
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

const ownerUser = { avatar: null, id: 'owner-1', name: 'Owner' }
const collabStub = {
  identityOf: vi.fn(async (readerId: string) => ({
    kind: 'reader' as const,
    readerId,
    user: { avatar: null, id: readerId, name: `Reader ${readerId}` },
  })),
  ownerIdentity: vi.fn(async () => ({
    kind: 'owner' as const,
    user: ownerUser,
  })),
}
const collaborators = new Set(['r1'])
const repositoryStub = {
  isCollaborator: vi.fn(async (_documentId: string, readerId: string) =>
    collaborators.has(readerId),
  ),
  markContributed: vi.fn(async () => undefined),
}

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64')

describe('collab room over the admin and web gateways', () => {
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
        { provide: CollabService, useValue: collabStub },
        { provide: CollabRepository, useValue: repositoryStub },
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

  const connectReader = async (readerId: string | null) => {
    if (readerId) {
      testApp.authService.getSessionUserFromHeaders.mockResolvedValueOnce({
        user: { id: readerId },
      } as never)
    }
    const client = await WsTestClient.connect(testApp.webUrl(), {
      headers: { cookie: 'better-auth.session_token=x' },
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
        caret: { id: 'p1', offset: 1 },
        draftId: 'd1',
      })
      const presence = await alice.waitFor(
        (e) => e.event === CollabWsEvents.presence,
      )
      expect(presence.payload).toMatchObject({
        caret: { id: 'p1', offset: 1 },
        documentId: 'doc-1',
        entry: null,
        user: ownerUser,
      })

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

  it('lets a co-author on the web socket edit with the owner in one room', async () => {
    const owner = await connect('owner')
    const reader = await connectReader('r1')
    try {
      await request(owner, CollabWsEvents.join, { draftId: 'd1' })
      expect(
        await request(reader, CollabWsEvents.join, { draftId: 'd1' }),
      ).toMatchObject({ data: { documentId: 'doc-1' }, ok: true })
      await owner.waitFor((e) => e.event === CollabWsEvents.peerJoined)

      draftStub.importCrdt.mockClear()
      await request(reader, CollabWsEvents.update, {
        draftId: 'd1',
        update: b64([3]),
      })
      expect(draftStub.importCrdt).toHaveBeenCalledWith(
        'd1',
        new Uint8Array([3]),
        expect.any(String),
        'human:r1',
      )
      const relayed = await owner.waitFor(
        (e) => e.event === CollabWsEvents.update,
      )
      expect(relayed.payload).toEqual({ documentId: 'doc-1', update: b64([3]) })

      await request(owner, CollabWsEvents.update, {
        draftId: 'd1',
        update: b64([4]),
      })
      const back = await reader.waitFor(
        (e) => e.event === CollabWsEvents.update,
      )
      expect(back.payload).toEqual({ documentId: 'doc-1', update: b64([4]) })

      await request(reader, CollabWsEvents.presence, {
        caret: null,
        draftId: 'd1',
      })
      const presence = await owner.waitFor(
        (e) => e.event === CollabWsEvents.presence,
      )
      expect(presence.payload).toMatchObject({
        user: { id: 'r1', name: 'Reader r1' },
      })

      testApp.moduleRef.get(CollabRoomService).revoke('doc-1', 'r1')
      const revoked = await reader.waitFor(
        (e) => e.event === CollabWsEvents.revoked,
      )
      expect(revoked.payload).toEqual({
        documentId: 'doc-1',
        reason: 'removed',
      })
      await owner.waitFor((e) => e.event === CollabWsEvents.peerLeft)
      expect(
        await request(reader, CollabWsEvents.update, {
          draftId: 'd1',
          update: b64([5]),
        }),
      ).toEqual({ code: 'NOT_JOINED', ok: false })
    } finally {
      await owner.closeAndWait()
      await reader.closeAndWait()
    }
  })

  it('refuses web sockets that are anonymous or not collaborators', async () => {
    const anonymous = await connectReader(null)
    const stranger = await connectReader('r2')
    try {
      expect(
        await request(anonymous, CollabWsEvents.join, { draftId: 'd1' }),
      ).toEqual({ code: 'NOT_AUTHENTICATED', ok: false })
      expect(
        await request(stranger, CollabWsEvents.join, { draftId: 'd1' }),
      ).toEqual({ code: 'FORBIDDEN', ok: false })
    } finally {
      await anonymous.closeAndWait()
      await stranger.closeAndWait()
    }
  })

  it('keeps collab rooms out of the public room join', async () => {
    const reader = await connectReader(null)
    try {
      expect(
        await request(reader, 'room.join', { room: 'collab:doc-1' }),
      ).toEqual({ code: 'ROOM_INVALID', ok: false })
    } finally {
      await reader.closeAndWait()
    }
  })

  it('waits for the session lookup before answering an early join', async () => {
    testApp.authService.getSessionUserFromHeaders.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ user: { id: 'r1' } } as never), 300),
        ),
    )
    const reader = await WsTestClient.connect(testApp.webUrl(), {
      headers: { cookie: 'better-auth.session_token=x' },
    })
    try {
      expect(
        await request(reader, CollabWsEvents.join, { draftId: 'd1' }),
      ).toMatchObject({ ok: true })
    } finally {
      await reader.closeAndWait()
    }
  })
})

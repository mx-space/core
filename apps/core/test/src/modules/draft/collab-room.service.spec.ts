import { describe, expect, it, vi } from 'vitest'

import { createAppException } from '~/common/errors'
import { AppErrorCode } from '~/common/errors/app-error-code'
import {
  type CollabIdentity,
  type CollabMember,
  CollabRoomService,
  CollabWsEvents,
} from '~/modules/draft/collab-room.service'
import type { DocumentChange } from '~/modules/draft/draft-crdt.service'

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64')

const owner: CollabIdentity = {
  kind: 'owner',
  user: { avatar: 'https://a.test/owner.png', id: 'owner-1', name: 'Owner' },
}
const reader = (readerId: string): CollabIdentity => ({
  kind: 'reader',
  readerId,
  user: { avatar: null, id: readerId, name: `Reader ${readerId}` },
})

const setup = (access: (documentId: string) => boolean = () => true) => {
  const order: string[] = []
  let revokeListener:
    ((documentId: string, readerId: string) => void) | undefined
  const contributions: Array<[string, string]> = []
  let listener: ((change: DocumentChange) => void) | undefined
  const crdt = {
    onDocumentChanged: vi.fn((next: (change: DocumentChange) => void) => {
      listener = next
      return () => {
        listener = undefined
      }
    }),
  }
  const drafts = {
    documentIdOf: vi.fn(async () => 'doc-1'),
    exportCrdtFor: vi.fn(async () => {
      order.push('export')
      return { documentId: 'doc-1', update: new Uint8Array([1, 2, 3]) }
    }),
    importCrdt: vi.fn(async () => undefined),
  }
  const published: {
    event: string
    exclude?: string
    payload: unknown
    room: string
  }[] = []
  const relay = {
    onRevoke: (listener: (documentId: string, readerId: string) => void) => {
      revokeListener = listener
      return () => {
        revokeListener = undefined
      }
    },
    publish: vi.fn(
      (event: string, payload: unknown, room: string, exclude?: string) => {
        published.push({ event, exclude, payload, room })
      },
    ),
    revoke: vi.fn((documentId: string, readerId: string) =>
      revokeListener?.(documentId, readerId),
    ),
  }
  const service = new CollabRoomService(drafts as never, crdt as never, relay, {
    canJoin: async (_member, documentId) => access(documentId),
    recordContribution: async (documentId, readerId) => {
      contributions.push([documentId, readerId])
    },
  })
  service.onModuleInit()
  const member = (
    connectionId: string,
    alive = () => true,
    identity: CollabIdentity = owner,
  ): CollabMember => ({
    alive,
    connectionId,
    identity,
    join: vi.fn(async () => {
      order.push('join')
    }),
    leave: vi.fn(async () => undefined),
    send: vi.fn(),
  })
  return {
    contributions,
    order,
    relay,
    change: (change: DocumentChange) => listener?.(change),
    drafts,
    member,
    published,
    service,
  }
}

describe('CollabRoomService', () => {
  it('joins the document room and returns what the member lacks', async () => {
    const { drafts, member, published, service } = setup()
    const alice = member('conn-a')

    const ack = await service.join(alice, { draftId: 'd1', since: b64([9]) })

    expect(ack).toEqual({
      data: {
        connectionId: 'conn-a',
        documentId: 'doc-1',
        update: b64([1, 2, 3]),
      },
      ok: true,
    })
    expect(drafts.exportCrdtFor).toHaveBeenCalledWith('d1', new Uint8Array([9]))
    expect(alice.join).toHaveBeenCalledWith('collab:doc-1')
    expect(published).toEqual([
      {
        event: CollabWsEvents.peerJoined,
        exclude: 'conn-a',
        payload: { connectionId: 'conn-a', documentId: 'doc-1' },
        room: 'collab:doc-1',
      },
    ])
  })

  it('stores an update with its origin and relays stored changes to everyone else', async () => {
    const { change, drafts, member, published, service } = setup()
    const alice = member('conn-a')
    await service.join(alice, { draftId: 'd1' })
    published.length = 0

    const ack = await service.update(alice, {
      draftId: 'd1',
      update: b64([7, 7]),
    })
    change({
      documentId: 'doc-1',
      origin: 'conn-a',
      update: new Uint8Array([7, 7]),
    })
    change({ documentId: 'doc-1', update: new Uint8Array([8]) })

    expect(ack).toEqual({ ok: true })
    expect(drafts.importCrdt).toHaveBeenCalledWith(
      'd1',
      new Uint8Array([7, 7]),
      'conn-a',
      undefined,
    )
    expect(published).toEqual([
      {
        event: CollabWsEvents.update,
        exclude: 'conn-a',
        payload: { documentId: 'doc-1', update: b64([7, 7]) },
        room: 'collab:doc-1',
      },
      {
        event: CollabWsEvents.update,
        exclude: undefined,
        payload: { documentId: 'doc-1', update: b64([8]) },
        room: 'collab:doc-1',
      },
    ])
  })

  it('acks a rejected update with its code', async () => {
    const { drafts, member, service } = setup()
    const alice = member('conn-a')
    await service.join(alice, { draftId: 'd1' })
    drafts.importCrdt.mockRejectedValueOnce(
      createAppException(AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED, {
        branchId: 'd1',
        reason: 'lineage',
      }),
    )

    const ack = await service.update(alice, {
      draftId: 'd1',
      update: b64([1]),
    })

    expect(ack).toEqual({ code: 'DRAFT_CRDT_UPDATE_REJECTED', ok: false })
  })

  it('joins the room before reading the snapshot, so no relayed change falls between', async () => {
    const { member, order, service } = setup()

    await service.join(member('conn-a'), { draftId: 'd1' })

    expect(order).toEqual(['join', 'export'])
  })

  it('undoes a join whose connection closed while it was in flight', async () => {
    const { member, published, service } = setup()
    let open = true
    const alice = member('conn-a', () => open)
    ;(alice.join as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      open = false
    })

    const ack = await service.join(alice, { draftId: 'd1' })

    expect(ack).toEqual({ code: 'NOT_CONNECTED', ok: false })
    expect(alice.leave).toHaveBeenCalledWith('collab:doc-1')
    expect(published).toEqual([])
    expect(
      await service.presence(alice, { caret: null, draftId: 'd1' }),
    ).toEqual({ code: 'NOT_JOINED', ok: false })
  })

  it('refuses members the access check rejects', async () => {
    const { drafts, member, service } = setup(() => false)
    const alice = member('conn-a')

    const ack = await service.join(alice, { draftId: 'd1' })

    expect(ack).toEqual({ code: 'FORBIDDEN', ok: false })
    expect(alice.join).not.toHaveBeenCalled()
    expect(drafts.exportCrdtFor).not.toHaveBeenCalled()
  })

  it('refuses updates from a connection that has not joined the document', async () => {
    const { drafts, member, service } = setup()

    const ack = await service.update(member('conn-a'), {
      draftId: 'd1',
      update: b64([1]),
    })

    expect(ack).toEqual({ code: 'NOT_JOINED', ok: false })
    expect(drafts.importCrdt).not.toHaveBeenCalled()
  })

  it('refuses an update over the size limit without storing it', async () => {
    const { drafts, member, service } = setup()

    const ack = await service.update(member('conn-a'), {
      draftId: 'd1',
      update: Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64'),
    })

    expect(ack).toEqual({ code: 'DRAFT_CRDT_UPDATE_REJECTED', ok: false })
    expect(drafts.importCrdt).not.toHaveBeenCalled()
  })

  it('relays presence stamped with the identity the server holds', async () => {
    const { member, published, service } = setup()
    const alice = member('conn-a')
    const caret = { anchor: { id: 'p1', offset: 2 } }

    expect(await service.presence(alice, { caret, draftId: 'd1' })).toEqual({
      code: 'NOT_JOINED',
      ok: false,
    })

    await service.join(alice, { draftId: 'd1' })
    published.length = 0
    const ack = await service.presence(alice, {
      caret,
      draftId: 'd1',
      user: { name: 'Mallory' },
    })
    await service.presence(alice, {
      caret: null,
      draftId: 'd1',
      entry: 'agent:42',
    })

    expect(ack).toEqual({ ok: true })
    expect(published).toEqual([
      {
        event: CollabWsEvents.presence,
        exclude: 'conn-a',
        payload: {
          caret,
          connectionId: 'conn-a',
          documentId: 'doc-1',
          entry: null,
          user: owner.user,
        },
        room: 'collab:doc-1',
      },
      {
        event: CollabWsEvents.presence,
        exclude: 'conn-a',
        payload: {
          caret: null,
          connectionId: 'conn-a',
          documentId: 'doc-1',
          entry: 'agent:42',
          user: { avatar: null, id: 'agent:42', name: 'AI' },
        },
        room: 'collab:doc-1',
      },
    ])
  })

  it('refuses agent presence entries and oversized carets from co-authors', async () => {
    const { member, service } = setup()
    const bob = member('conn-b', () => true, reader('r1'))
    await service.join(bob, { draftId: 'd1' })

    expect(
      await service.presence(bob, {
        caret: null,
        draftId: 'd1',
        entry: 'agent:1',
      }),
    ).toEqual({ code: 'FORBIDDEN', ok: false })
    expect(
      await service.presence(bob, { caret: 'x'.repeat(5000), draftId: 'd1' }),
    ).toEqual({ code: 'VALIDATION_FAILED', ok: false })
  })

  it('binds a co-author update to their reader id and records the first contribution', async () => {
    const { contributions, drafts, member, service } = setup()
    const bob = member('conn-b', () => true, reader('r1'))
    await service.join(bob, { draftId: 'd1' })

    await service.update(bob, { draftId: 'd1', update: b64([1]) })
    await service.update(bob, { draftId: 'd1', update: b64([2]) })

    expect(drafts.importCrdt).toHaveBeenCalledWith(
      'd1',
      new Uint8Array([1]),
      'conn-b',
      'human:r1',
    )
    expect(contributions).toEqual([['doc-1', 'r1']])
  })

  it("drops co-author frames past the rate limit but never the owner's", async () => {
    const { member, service } = setup()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const bob = member('conn-b', () => true, reader('r1'))
    const alice = member('conn-a')
    await service.join(bob, { draftId: 'd1' })
    await service.join(alice, { draftId: 'd1' })

    const send = (who: CollabMember) =>
      service.presence(who, { caret: null, draftId: 'd1' })
    for (let index = 0; index < 120; index += 1) await send(bob)
    const limited = await send(bob)
    now.mockReturnValue(1_000_000 + 1000)
    const refilled = await send(bob)
    for (let index = 0; index < 200; index += 1) await send(alice)
    const ownerAck = await send(alice)
    now.mockRestore()

    expect(limited).toEqual({ code: 'RATE_LIMITED', ok: false })
    expect(refilled).toEqual({ ok: true })
    expect(ownerAck).toEqual({ ok: true })
  })

  it('drops a removed co-author from the room on every pod', async () => {
    const { member, published, relay, service } = setup()
    const bob = member('conn-b', () => true, reader('r1'))
    const carol = member('conn-c', () => true, reader('r2'))
    await service.join(bob, { draftId: 'd1' })
    await service.join(carol, { draftId: 'd1' })
    published.length = 0

    service.revoke('doc-1', 'r1')

    expect(relay.revoke).toHaveBeenCalledWith('doc-1', 'r1')
    expect(bob.leave).toHaveBeenCalledWith('collab:doc-1')
    expect(bob.send).toHaveBeenCalledWith(CollabWsEvents.revoked, {
      documentId: 'doc-1',
    })
    expect(carol.leave).not.toHaveBeenCalled()
    expect(published.map((frame) => [frame.event, frame.payload])).toEqual([
      [
        CollabWsEvents.peerLeft,
        { connectionId: 'conn-b', documentId: 'doc-1' },
      ],
    ])
    expect(
      await service.update(bob, { draftId: 'd1', update: b64([1]) }),
    ).toEqual({ code: 'NOT_JOINED', ok: false })
  })

  it('announces a member leaving on leave and on disconnect', async () => {
    const { member, published, service } = setup()
    const alice = member('conn-a')
    const bob = member('conn-b')
    await service.join(alice, { draftId: 'd1' })
    await service.join(bob, { draftId: 'd1' })
    published.length = 0

    await service.leave(alice, { draftId: 'd1' })
    service.disconnect('conn-b')
    service.disconnect('conn-b')

    expect(alice.leave).toHaveBeenCalledWith('collab:doc-1')
    expect(published.map((frame) => [frame.event, frame.payload])).toEqual([
      [
        CollabWsEvents.peerLeft,
        { connectionId: 'conn-a', documentId: 'doc-1' },
      ],
      [
        CollabWsEvents.peerLeft,
        { connectionId: 'conn-b', documentId: 'doc-1' },
      ],
    ])
  })

  it('rejects malformed payloads', async () => {
    const { member, service } = setup()

    expect(await service.join(member('conn-a'), { draftId: 3 })).toEqual({
      code: 'VALIDATION_FAILED',
      ok: false,
    })
  })

  it('drops a removed co-author on this pod even if the broadcast is lost', async () => {
    const { member, relay, service } = setup()
    relay.revoke.mockImplementation(() => undefined)
    const bob = member('conn-b', () => true, reader('r1'))
    await service.join(bob, { draftId: 'd1' })

    service.revoke('doc-1', 'r1')

    expect(bob.leave).toHaveBeenCalledWith('collab:doc-1')
    expect(
      await service.update(bob, { draftId: 'd1', update: b64([1]) }),
    ).toEqual({ code: 'NOT_JOINED', ok: false })
  })

  it('backs out a join whose access was removed while it was loading', async () => {
    let allowed = true
    const { drafts, member, service } = setup(() => allowed)
    drafts.exportCrdtFor.mockImplementationOnce(async () => {
      allowed = false
      return { documentId: 'doc-1', update: new Uint8Array([1]) }
    })
    const bob = member('conn-b', () => true, reader('r1'))

    const ack = await service.join(bob, { draftId: 'd1' })

    expect(ack).toEqual({ code: 'FORBIDDEN', ok: false })
    expect(bob.leave).toHaveBeenCalledWith('collab:doc-1')
    expect(
      await service.update(bob, { draftId: 'd1', update: b64([1]) }),
    ).toEqual({ code: 'NOT_JOINED', ok: false })
  })

  it('leaves the room again when loading the document fails', async () => {
    const { drafts, member, service } = setup()
    drafts.exportCrdtFor.mockRejectedValueOnce(new Error('boom'))
    const bob = member('conn-b', () => true, reader('r1'))

    const ack = await service.join(bob, { draftId: 'd1' })

    expect(ack).toEqual({ code: 'INTERNAL_ERROR', ok: false })
    expect(bob.leave).toHaveBeenCalledWith('collab:doc-1')
  })
})

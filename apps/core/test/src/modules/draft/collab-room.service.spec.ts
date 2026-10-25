import { describe, expect, it, vi } from 'vitest'

import { createAppException } from '~/common/errors'
import { AppErrorCode } from '~/common/errors/app-error-code'
import {
  type CollabMember,
  CollabRoomService,
  CollabWsEvents,
} from '~/modules/draft/collab-room.service'
import type { DocumentChange } from '~/modules/draft/draft-crdt.service'

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64')

const setup = () => {
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
    exportCrdtFor: vi.fn(async () => ({
      documentId: 'doc-1',
      update: new Uint8Array([1, 2, 3]),
    })),
    importCrdt: vi.fn(async () => undefined),
  }
  const published: {
    event: string
    exclude?: string
    payload: unknown
    room: string
  }[] = []
  const relay = {
    publish: vi.fn(
      (event: string, payload: unknown, room: string, exclude?: string) => {
        published.push({ event, exclude, payload, room })
      },
    ),
  }
  const service = new CollabRoomService(drafts as never, crdt as never, relay)
  service.onModuleInit()
  const member = (connectionId: string): CollabMember => ({
    connectionId,
    join: vi.fn(async () => undefined),
    leave: vi.fn(async () => undefined),
  })
  return {
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
    drafts.importCrdt.mockRejectedValueOnce(
      createAppException(AppErrorCode.DRAFT_CRDT_UPDATE_REJECTED, {
        branchId: 'd1',
        reason: 'lineage',
      }),
    )

    const ack = await service.update(member('conn-a'), {
      draftId: 'd1',
      update: b64([1]),
    })

    expect(ack).toEqual({ code: 'DRAFT_CRDT_UPDATE_REJECTED', ok: false })
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

  it('relays presence to the rest of the room only for joined members', async () => {
    const { member, published, service } = setup()
    const alice = member('conn-a')

    expect(
      await service.presence(alice, { draftId: 'd1', state: b64([5]) }),
    ).toEqual({ code: 'NOT_JOINED', ok: false })

    await service.join(alice, { draftId: 'd1' })
    published.length = 0
    const ack = await service.presence(alice, {
      draftId: 'd1',
      state: b64([5]),
    })

    expect(ack).toEqual({ ok: true })
    expect(published).toEqual([
      {
        event: CollabWsEvents.presence,
        exclude: 'conn-a',
        payload: { documentId: 'doc-1', state: b64([5]) },
        room: 'collab:doc-1',
      },
    ])
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
})

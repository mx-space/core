import { LoroDoc, VersionVector } from 'loro-crdt'
import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'

import { type CrdtTransport, createCrdtSync } from './crdt-sync'

const serverWith = (seed: string) => {
  const server = new LoroDoc()
  server.getText('title').insert(0, seed)
  server.commit()
  return server
}

const fakeTransport = (server: LoroDoc) => {
  const pushes: Uint8Array[] = []
  const transport: CrdtTransport = {
    pull: vi.fn(async (since?: Uint8Array) =>
      since
        ? server.export({ from: VersionVector.decode(since), mode: 'update' })
        : server.export({ mode: 'snapshot' }),
    ),
    push: vi.fn(async (bytes: Uint8Array) => {
      pushes.push(bytes)
      server.import(bytes)
    }),
  }
  return { pushes, transport }
}

const type = (doc: LoroDoc, value: string) => {
  const title = doc.getText('title')
  title.insert(title.length, value)
  doc.commit({ message: 'human:owner' })
}

describe('createCrdtSync', () => {
  it('loads the server document and batches local edits into one push', async () => {
    const server = serverWith('Hi')
    const { pushes, transport } = fakeTransport(server)
    const doc = new LoroDoc()
    const sync = await createCrdtSync({ batchMs: 5, doc, transport })

    type(doc, ' a')
    type(doc, 'b')
    await vi.waitFor(() => expect(pushes).toHaveLength(1))

    expect(server.getText('title').toString()).toBe('Hi ab')
    expect(sync.pending()).toBe(false)
    sync.dispose()
  })

  it('keeps unsent edits after a failed push and delivers them on retry', async () => {
    const server = serverWith('')
    const { transport } = fakeTransport(server)
    const push = transport.push
    let fail = true
    transport.push = vi.fn(async (bytes: Uint8Array) => {
      if (fail) {
        fail = false
        throw new TypeError('network down')
      }
      await push(bytes)
    })
    const statuses: string[] = []
    const doc = new LoroDoc()
    const sync = await createCrdtSync({
      batchMs: 5,
      doc,
      onStatus: (status) => statuses.push(status),
      retryMs: 5,
      transport,
    })

    type(doc, 'kept')
    await vi.waitFor(() =>
      expect(server.getText('title').toString()).toBe('kept'),
    )

    expect(statuses).toContain('offline')
    expect(statuses.at(-1)).toBe('synced')
    sync.dispose()
  })

  it('stops pushing and reports when the server rejects an update', async () => {
    const server = serverWith('')
    const { transport } = fakeTransport(server)
    transport.push = vi.fn(async () => {
      throw new ApiRequestError('rejected', 'DRAFT_CRDT_UPDATE_REJECTED', 400)
    })
    const onRejected = vi.fn()
    const doc = new LoroDoc()
    const sync = await createCrdtSync({
      batchMs: 5,
      doc,
      onRejected,
      retryMs: 5,
      transport,
    })

    type(doc, 'x')
    await vi.waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1))
    type(doc, 'y')
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(transport.push).toHaveBeenCalledTimes(1)
    sync.dispose()
  })

  it('pulls only what it lacks and applies it through the importer', async () => {
    const server = serverWith('a')
    const { transport } = fakeTransport(server)
    const doc = new LoroDoc()
    const apply = vi.fn((bytes: Uint8Array) => doc.import(bytes))
    const sync = await createCrdtSync({ apply, batchMs: 5, doc, transport })
    const peer = new LoroDoc()
    peer.import(server.export({ mode: 'snapshot' }))
    type(peer, 'b')
    server.import(peer.export({ mode: 'update' }))

    await sync.pull()

    expect(doc.getText('title').toString()).toBe('ab')
    expect(apply).toHaveBeenCalledTimes(1)
    expect(sync.pending()).toBe(false)
    sync.dispose()
  })

  it('flushes pending edits on demand', async () => {
    const server = serverWith('')
    const { transport } = fakeTransport(server)
    const doc = new LoroDoc()
    const sync = await createCrdtSync({ batchMs: 10_000, doc, transport })

    type(doc, 'now')
    await sync.flush()

    expect(server.getText('title').toString()).toBe('now')
    sync.dispose()
  })

  it('stays pending and flushes everything while a slow push is in flight', async () => {
    const server = serverWith('')
    const { transport } = fakeTransport(server)
    const push = transport.push
    transport.push = vi.fn(async (bytes: Uint8Array) => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      await push(bytes)
    })
    const doc = new LoroDoc()
    const sync = await createCrdtSync({ batchMs: 5, doc, transport })

    type(doc, 'a')
    await new Promise((resolve) => setTimeout(resolve, 15))
    type(doc, 'b')
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(sync.pending()).toBe(true)
    await sync.flush()
    expect(server.getText('title').toString()).toBe('ab')
    expect(sync.pending()).toBe(false)
    sync.dispose()
  })

  it('does not skip in-flight ops when a pull lands mid-push', async () => {
    const server = serverWith('')
    const { transport } = fakeTransport(server)
    const push = transport.push
    let failNext = true
    transport.push = vi.fn(async (bytes: Uint8Array) => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      if (failNext) {
        failNext = false
        throw new TypeError('network down')
      }
      await push(bytes)
    })
    const doc = new LoroDoc()
    const sync = await createCrdtSync({
      batchMs: 1,
      doc,
      retryMs: 5,
      transport,
    })

    type(doc, 'lost?')
    await new Promise((resolve) => setTimeout(resolve, 8))
    await sync.pull()
    await vi.waitFor(() =>
      expect(server.getText('title').toString()).toBe('lost?'),
    )
    sync.dispose()
  })

  it('refuses to flush after the server rejected an update', async () => {
    const server = serverWith('')
    const { transport } = fakeTransport(server)
    transport.push = vi.fn(async () => {
      throw new ApiRequestError('no', 'DRAFT_CRDT_UPDATE_REJECTED', 400)
    })
    const doc = new LoroDoc()
    const sync = await createCrdtSync({ batchMs: 5, doc, transport })

    type(doc, 'x')
    await expect(sync.flush()).rejects.toThrow()
    sync.dispose()
  })

  it('applies a pushed remote update and keeps syncing local edits', async () => {
    const server = serverWith('a')
    const { pushes, transport } = fakeTransport(server)
    const doc = new LoroDoc()
    const apply = vi.fn((bytes: Uint8Array) => doc.import(bytes))
    const sync = await createCrdtSync({ apply, batchMs: 5, doc, transport })
    const peer = new LoroDoc()
    peer.import(server.export({ mode: 'snapshot' }))
    const from = peer.oplogVersion()
    type(peer, 'b')
    const relayed = peer.export({ from, mode: 'update' })
    server.import(relayed)

    sync.receive(relayed)
    type(doc, 'c')
    await vi.waitFor(() => expect(pushes).toHaveLength(1))

    expect(apply).toHaveBeenCalledWith(relayed)
    expect(server.getText('title').toString()).toBe('abc')
    sync.dispose()
  })
})

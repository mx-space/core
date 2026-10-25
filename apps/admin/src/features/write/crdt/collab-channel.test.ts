import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'

import { type CollabSocket, createCollabChannel } from './collab-channel'

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))

const fakeSocket = (initial: CollabSocket['state'] = 'open') => {
  const handlers = new Map<string, Set<(payload: any) => void>>()
  const requests: { event: string; payload: any }[] = []
  let reply: (event: string, payload: any) => Promise<any> = async (event) =>
    event === 'collab.join'
      ? {
          data: {
            connectionId: 'conn-x',
            documentId: 'doc-1',
            update: b64([1, 2]),
          },
          ok: true,
        }
      : { ok: true }
  const socket = {
    emit: (event: string, payload: unknown) => {
      for (const handler of handlers.get(event) ?? []) handler(payload)
    },
    on: (event: string, handler: (payload: any) => void) => {
      let set = handlers.get(event)
      if (!set) {
        set = new Set()
        handlers.set(event, set)
      }
      set.add(handler)
      return () => set.delete(handler)
    },
    replyWith: (next: typeof reply) => {
      reply = next
    },
    request: vi.fn(async (event: string, payload: any) => {
      requests.push({ event, payload })
      return reply(event, payload)
    }),
    requests,
    state: initial,
  }
  return socket
}

const httpTransport = () => ({
  pull: vi.fn(async () => new Uint8Array([7])),
  push: vi.fn(async () => undefined),
})

const setup = (socket: ReturnType<typeof fakeSocket> | null) => {
  let listener: ((socket: CollabSocket | null) => void) | undefined
  const http = httpTransport()
  const onRemote = vi.fn()
  const onReconnect = vi.fn()
  const onJoined = vi.fn()
  const channel = createCollabChannel({
    draftId: 'd1',
    http,
    onJoined,
    onReconnect,
    onRemote,
    subscribeSocket: (next) => {
      listener = next
      next(socket)
      return () => {
        listener = undefined
      }
    },
  })
  return {
    channel,
    http,
    onJoined,
    onReconnect,
    onRemote,
    swapSocket: (next: CollabSocket | null) => listener?.(next),
  }
}

describe('createCollabChannel', () => {
  it('joins over the socket and pushes updates as frames', async () => {
    const socket = fakeSocket()
    const { channel, http } = setup(socket)

    expect(await channel.pull()).toEqual(new Uint8Array([1, 2]))
    await channel.push(new Uint8Array([3]))

    expect(socket.requests).toEqual([
      { event: 'collab.join', payload: { draftId: 'd1' } },
      { event: 'collab.update', payload: { draftId: 'd1', update: b64([3]) } },
    ])
    expect(http.pull).not.toHaveBeenCalled()
    expect(http.push).not.toHaveBeenCalled()
    expect(channel.live()).toBe(true)
  })

  it('reports the connection id the server gave it on join', async () => {
    const { channel, onJoined } = setup(fakeSocket())

    await channel.pull()

    expect(onJoined).toHaveBeenCalledWith('conn-x')
  })

  it('routes presence and membership frames for the joined document', async () => {
    const socket = fakeSocket()
    const presence = vi.fn()
    const joined = vi.fn()
    const left = vi.fn()
    const channel = createCollabChannel({
      draftId: 'd1',
      http: httpTransport(),
      onPeerJoined: joined,
      onPeerLeft: left,
      onPresence: presence,
      onRemote: () => undefined,
      subscribeSocket: (next) => {
        next(socket)
        return () => undefined
      },
    })
    await channel.pull()

    socket.emit('collab.presence', {
      caret: null,
      connectionId: 'c2',
      documentId: 'doc-1',
      entry: null,
      user: { avatar: null, id: 'r1', name: 'Bob' },
    })
    socket.emit('collab.peer.joined', {
      connectionId: 'c2',
      documentId: 'doc-1',
    })
    socket.emit('collab.peer.left', { connectionId: 'c2', documentId: 'doc-1' })
    channel.sendPresence({ caret: { anchor: null, focus: null } })

    expect(presence).toHaveBeenCalledWith({
      caret: null,
      connectionId: 'c2',
      entry: null,
      user: { avatar: null, id: 'r1', name: 'Bob' },
    })
    expect(joined).toHaveBeenCalledWith('c2')
    expect(left).toHaveBeenCalledWith('c2')
    expect(socket.requests.at(-1)).toEqual({
      event: 'collab.presence',
      payload: { caret: { anchor: null, focus: null }, draftId: 'd1' },
    })
  })

  it('sends the version it already has when re-joining', async () => {
    const socket = fakeSocket()
    const { channel } = setup(socket)

    await channel.pull(new Uint8Array([5, 6]))

    expect(socket.requests[0]).toEqual({
      event: 'collab.join',
      payload: { draftId: 'd1', since: b64([5, 6]) },
    })
  })

  it('applies relayed updates only for the joined document', async () => {
    const socket = fakeSocket()
    const { channel, onRemote } = setup(socket)
    await channel.pull()

    socket.emit('collab.update', { documentId: 'other', update: b64([9]) })
    socket.emit('collab.update', { documentId: 'doc-1', update: b64([4]) })

    expect(onRemote).toHaveBeenCalledTimes(1)
    expect(onRemote).toHaveBeenCalledWith(new Uint8Array([4]))
  })

  it('falls back to HTTP while the socket is down', async () => {
    const socket = fakeSocket('reconnecting')
    const { channel, http } = setup(socket)

    expect(await channel.pull()).toEqual(new Uint8Array([7]))
    await channel.push(new Uint8Array([3]))

    expect(http.pull).toHaveBeenCalledTimes(1)
    expect(http.push).toHaveBeenCalledWith(new Uint8Array([3]))
    expect(channel.live()).toBe(false)
  })

  it('sends oversized updates over HTTP even when the socket is live', async () => {
    const socket = fakeSocket()
    const { channel, http } = setup(socket)
    await channel.pull()

    await channel.push(new Uint8Array(600 * 1024))

    expect(http.push).toHaveBeenCalledTimes(1)
    expect(socket.requests.map((request) => request.event)).toEqual([
      'collab.join',
    ])
  })

  it('surfaces a rejected frame as the rejection error', async () => {
    const socket = fakeSocket()
    const { channel } = setup(socket)
    await channel.pull()
    socket.replyWith(async () => {
      throw Object.assign(new Error('Request rejected'), {
        code: 'DRAFT_CRDT_UPDATE_REJECTED',
      })
    })

    const error = await channel.push(new Uint8Array([1])).catch((e) => e)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error.code).toBe('DRAFT_CRDT_UPDATE_REJECTED')
  })

  it('asks to resync when the socket comes back after a drop', async () => {
    const socket = fakeSocket()
    const { channel, onReconnect } = setup(socket)
    await channel.pull()

    socket.state = 'reconnecting'
    socket.emit('$state', 'reconnecting')
    expect(channel.live()).toBe(false)
    socket.state = 'open'
    socket.emit('$state', 'open')

    expect(onReconnect).toHaveBeenCalledTimes(1)
  })

  it('stops listening once disposed', async () => {
    const socket = fakeSocket()
    const { channel, onRemote } = setup(socket)
    await channel.pull()

    channel.dispose()
    socket.emit('collab.update', { documentId: 'doc-1', update: b64([4]) })

    expect(onRemote).not.toHaveBeenCalled()
    expect(socket.requests.at(-1)).toEqual({
      event: 'collab.leave',
      payload: { draftId: 'd1' },
    })
  })

  it('keeps updates relayed while the join is in flight', async () => {
    const socket = fakeSocket()
    let release: () => void = () => undefined
    socket.replyWith(
      (event) =>
        new Promise((resolve) => {
          release = () =>
            resolve(
              event === 'collab.join'
                ? {
                    data: {
                      connectionId: 'c',
                      documentId: 'doc-1',
                      update: b64([1]),
                    },
                    ok: true,
                  }
                : { ok: true },
            )
        }),
    )
    const { channel, onRemote } = setup(socket)

    const joining = channel.pull()
    socket.emit('collab.update', { documentId: 'doc-1', update: b64([5]) })
    socket.emit('collab.update', { documentId: 'other', update: b64([6]) })
    release()
    await joining
    await Promise.resolve()

    expect(onRemote).toHaveBeenCalledTimes(1)
    expect(onRemote).toHaveBeenCalledWith(new Uint8Array([5]))
  })

  it('loads over HTTP when the server cannot join the room', async () => {
    const socket = fakeSocket()
    socket.replyWith(async () => {
      throw Object.assign(new Error('Request rejected'), {
        code: 'UNSUPPORTED_EVENT',
      })
    })
    const { channel, http } = setup(socket)

    expect(await channel.pull()).toEqual(new Uint8Array([7]))
    expect(http.pull).toHaveBeenCalledTimes(1)
    expect(channel.live()).toBe(false)
  })

  it('leaves again when disposed while a join is in flight', async () => {
    const socket = fakeSocket()
    let release: () => void = () => undefined
    socket.replyWith((event) =>
      event === 'collab.join'
        ? new Promise((resolve) => {
            release = () =>
              resolve({
                data: {
                  connectionId: 'c',
                  documentId: 'doc-1',
                  update: b64([1]),
                },
                ok: true,
              })
          })
        : Promise.resolve({ ok: true }),
    )
    const { channel, onJoined } = setup(socket)

    const joining = channel.pull()
    channel.dispose()
    release()
    await joining.catch(() => undefined)

    expect(onJoined).not.toHaveBeenCalled()
    expect(socket.requests.at(-1)).toEqual({
      event: 'collab.leave',
      payload: { draftId: 'd1' },
    })
  })

  it('joins once the socket opens when the first load went over HTTP', async () => {
    const socket = fakeSocket('connecting')
    const { channel, onReconnect } = setup(socket)
    await channel.pull()

    socket.state = 'open'
    socket.emit('$state', 'open')

    expect(onReconnect).toHaveBeenCalledTimes(1)
  })

  it('stops relaying and reports once the owner revokes access', async () => {
    const socket = fakeSocket()
    const onRevoked = vi.fn()
    const onRemote = vi.fn()
    const channel = createCollabChannel({
      draftId: 'd1',
      http: httpTransport(),
      onRemote,
      onRevoked,
      subscribeSocket: (next) => {
        next(socket)
        return () => undefined
      },
    })
    await channel.pull()

    socket.emit('collab.revoked', { documentId: 'other' })
    expect(onRevoked).not.toHaveBeenCalled()
    socket.emit('collab.revoked', { documentId: 'doc-1' })
    socket.emit('collab.update', { documentId: 'doc-1', update: b64([4]) })

    expect(onRevoked).toHaveBeenCalledTimes(1)
    expect(onRemote).not.toHaveBeenCalled()
    expect(channel.live()).toBe(false)
  })

  it('passes on why the room was closed and when the document was rebuilt', async () => {
    const socket = fakeSocket()
    const onRevoked = vi.fn()
    const onReset = vi.fn()
    const channel = createCollabChannel({
      draftId: 'd1',
      http: httpTransport(),
      onRemote: vi.fn(),
      onReset,
      onRevoked,
      subscribeSocket: (next) => {
        next(socket)
        return () => undefined
      },
    })
    await channel.pull()

    socket.emit('collab.reset', { documentId: 'other' })
    expect(onReset).not.toHaveBeenCalled()
    socket.emit('collab.reset', { documentId: 'doc-1' })
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(channel.live()).toBe(false)

    await channel.pull()
    socket.emit('collab.revoked', { documentId: 'doc-1', reason: 'deleted' })
    expect(onRevoked).toHaveBeenCalledWith('deleted')
  })
})

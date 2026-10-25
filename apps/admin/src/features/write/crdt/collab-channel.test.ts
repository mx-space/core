import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'

import { type CollabSocket, createCollabChannel } from './collab-channel'

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))

const fakeSocket = (initial: CollabSocket['state'] = 'open') => {
  const handlers = new Map<string, Set<(payload: any) => void>>()
  const requests: { event: string; payload: any }[] = []
  let reply: (event: string, payload: any) => Promise<any> = async (event) =>
    event === 'collab.join'
      ? { data: { documentId: 'doc-1', update: b64([1, 2]) }, ok: true }
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
  const channel = createCollabChannel({
    draftId: 'd1',
    http,
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
})

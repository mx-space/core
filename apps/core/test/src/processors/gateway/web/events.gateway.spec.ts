import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function createFakes() {
  const conns = new Map<string, string>()
  const rooms = new Map<string, Set<string>>()
  const metadata = new Map<string, Record<string, unknown>>()

  const presence = {
    nodeId: 'node-test',
    addConnection: vi.fn(async (_ns: string, id: string) => {
      conns.set(id, 'node-test')
    }),
    removeConnection: vi.fn(async (_ns: string, id: string) => {
      conns.delete(id)
    }),
    joinRoom: vi.fn(async (_ns: string, room: string, id: string) => {
      const members = rooms.get(room) ?? new Set<string>()
      members.add(id)
      rooms.set(room, members)
    }),
    leaveRoom: vi.fn(async (_ns: string, room: string, id: string) => {
      const members = rooms.get(room)
      if (!members) return
      members.delete(id)
      if (members.size === 0) rooms.delete(room)
    }),
    roomMemberIds: vi.fn(async (_ns: string, room: string) => [
      ...(rooms.get(room) ?? []),
    ]),
    connectionIds: vi.fn(async () => [...conns.keys()]),
    roomSizes: vi.fn(async () =>
      Object.fromEntries([...rooms].map(([room, ids]) => [room, ids.size])),
    ),
  }

  const defaults = () => ({ sessionId: '', roomJoinedAtMap: {} })
  const gatewayService = {
    setSocketMetadata: vi.fn(
      async (socket: { id: string }, value: Record<string, unknown>) => {
        metadata.set(socket.id, {
          ...metadata.get(socket.id),
          ...value,
        })
      },
    ),
    getSocketMetadata: vi.fn(async (socket: { id: string }) => ({
      ...defaults(),
      ...metadata.get(socket.id),
    })),
    getSocketMetadataMany: vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ ...defaults(), ...metadata.get(id) })),
    ),
    clearSocketMetadata: vi.fn(async (socket: { id: string }) => {
      metadata.delete(socket.id)
    }),
  }

  const bus = { register: vi.fn(() => () => undefined), publish: vi.fn() }
  const redisService = { getClient: vi.fn() }

  return { conns, rooms, metadata, presence, gatewayService, bus, redisService }
}

function createFakeWs() {
  return {
    OPEN: 1,
    readyState: 1,
    send: vi.fn(),
    on: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
  }
}

const request = {
  url: '/ws/web?socket_session_id=session-1&lang=zh-CN',
  headers: { cookie: 'better-auth.session=abc', origin: 'https://example.com' },
}

describe('WebEventsGateway connection tracking', () => {
  let fakes: ReturnType<typeof createFakes>
  let releaseAuth: (value: unknown) => void
  let gateway: WebEventsGateway

  beforeEach(() => {
    fakes = createFakes()
    const authService = {
      getSessionUserFromHeaders: vi.fn(
        () =>
          new Promise((resolve) => {
            releaseAuth = resolve
          }),
      ),
    }
    gateway = new WebEventsGateway(
      fakes.redisService as any,
      fakes.gatewayService as any,
      authService as any,
      fakes.bus as any,
      fakes.presence as any,
    )
  })

  it('registers presence, metadata and the lang room on a completed connect', async () => {
    const ws = createFakeWs()
    const connecting = gateway.handleConnection(ws as any, request as any)

    await flush()
    releaseAuth({ user: { id: 'reader-1' } })
    await connecting

    expect(fakes.conns.size).toBe(1)
    const [id] = [...fakes.conns.keys()]
    expect(fakes.metadata.get(id)).toMatchObject({
      sessionId: 'session-1',
      lang: 'zh-CN',
      readerId: 'reader-1',
    })
    expect([...(fakes.rooms.get('lang:zh-CN') ?? [])]).toEqual([id])
  })

  it('leaves no phantom presence when the socket closes during the auth lookup', async () => {
    const ws = createFakeWs()
    const connecting = gateway.handleConnection(ws as any, request as any)

    await flush()
    ws.readyState = 3
    await gateway.handleDisconnect(ws as any)

    // The disconnect cleanup really ran while the connect was still in flight;
    // without this the race below would be vacuous.
    expect(fakes.gatewayService.clearSocketMetadata).toHaveBeenCalled()
    expect(fakes.conns.size).toBe(0)

    releaseAuth({ user: { id: 'reader-1' } })
    await connecting

    expect(fakes.conns.size).toBe(0)
    expect(fakes.metadata.size).toBe(0)
    expect(fakes.rooms.size).toBe(0)
    expect((gateway as any).roomManager.membersOf('lang:zh-CN')).toEqual([])
    expect((gateway as any).registry.size).toBe(0)
    await expect(gateway.getCurrentClientCount()).resolves.toBe(0)
  })
})

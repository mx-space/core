import { WebSocket as NodeWebSocket, WebSocketServer } from 'ws'
import { describe, expect, it, onTestFinished } from 'vitest'

import {
  type WsClient,
  type WsClientOptions,
  type WsClientState,
  createWsClient,
} from '../src/client.js'
import { buildEnvelope, isWsEnvelope } from '../src/protocol.js'

type TestSocket = InstanceType<typeof NodeWebSocket>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForState(
  client: WsClient,
  target: WsClientState,
): Promise<void> {
  if (client.state === target) return Promise.resolve()
  return new Promise((resolve) => {
    const off = client.on('$state', (state) => {
      if (state !== target) return
      off()
      resolve()
    })
  })
}

interface TestServer {
  port: number
  nextConnection(): Promise<TestSocket>
  close(): Promise<void>
}

function startServer(): Promise<TestServer> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' })
    const sockets: TestSocket[] = []
    const pendingResolvers: Array<(socket: TestSocket) => void> = []

    wss.on('connection', (socket) => {
      sockets.push(socket)
      const resolver = pendingResolvers.shift()
      if (resolver) resolver(socket)
    })

    wss.once('listening', () => {
      const address = wss.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        nextConnection() {
          return new Promise((res) => pendingResolvers.push(res))
        },
        close() {
          return new Promise((res) => {
            for (const socket of sockets) socket.close()
            wss.close(() => res())
          })
        },
      })
    })
  })
}

async function connectedHarness(
  overrides: Partial<WsClientOptions> = {},
): Promise<{ server: TestServer; client: WsClient; serverSocket: TestSocket }> {
  const server = await startServer()
  const connection = server.nextConnection()
  const client = createWsClient({
    url: `ws://127.0.0.1:${server.port}`,
    webSocketImpl: NodeWebSocket as unknown as typeof WebSocket,
    pingIntervalMs: 60_000,
    ...overrides,
  })
  onTestFinished(async () => {
    client.close()
    await server.close()
  })
  const serverSocket = await connection
  await waitForState(client, 'open')
  return { server, client, serverSocket }
}

describe('createWsClient', () => {
  it('starts connecting and transitions to open', async () => {
    const server = await startServer()
    const client = createWsClient({
      url: `ws://127.0.0.1:${server.port}`,
      webSocketImpl: NodeWebSocket as unknown as typeof WebSocket,
      pingIntervalMs: 60_000,
    })
    onTestFinished(async () => {
      client.close()
      await server.close()
    })

    expect(client.state).toBe('connecting')
    await waitForState(client, 'open')
    expect(client.state).toBe('open')
  })

  it('appends query params to the connection URL', async () => {
    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' })
    const requestUrl = new Promise<string>((resolve) => {
      wss.once('connection', (_socket, request) => resolve(request.url ?? ''))
    })
    onTestFinished(() => {
      wss.close()
    })
    await new Promise<void>((resolve) => wss.once('listening', () => resolve()))
    const address = wss.address()
    const port = typeof address === 'object' && address ? address.port : 0

    const client = createWsClient({
      url: `ws://127.0.0.1:${port}`,
      query: { token: 'abc', room: '1' },
      webSocketImpl: NodeWebSocket as unknown as typeof WebSocket,
      pingIntervalMs: 60_000,
    })
    onTestFinished(() => {
      client.close()
    })

    const url = await requestUrl
    expect(url).toContain('token=abc')
    expect(url).toContain('room=1')
  })

  it('dispatches events to handlers and supports unsubscribe', async () => {
    const { client, serverSocket } = await connectedHarness()

    const received: unknown[] = []
    const off = client.on('greet', (payload) => received.push(payload))

    serverSocket.send(JSON.stringify(buildEnvelope('greet', { hi: 1 })))
    await delay(50)
    expect(received).toEqual([{ hi: 1 }])

    off()
    serverSocket.send(JSON.stringify(buildEnvelope('greet', { hi: 2 })))
    await delay(50)
    expect(received).toEqual([{ hi: 1 }])
  })

  it('resolves request() with the ack payload when ok:true', async () => {
    const { client, serverSocket } = await connectedHarness()

    serverSocket.on('message', (raw) => {
      const parsed: unknown = JSON.parse(String(raw))
      if (!isWsEnvelope(parsed) || parsed.event === 'ack') return
      serverSocket.send(
        JSON.stringify(
          buildEnvelope(
            'ack',
            { ok: true, echo: parsed.payload },
            parsed.id,
          ),
        ),
      )
    })

    const result = await client.request('add', { a: 1 })
    expect(result).toEqual({ ok: true, echo: { a: 1 } })
  })

  it('rejects request() with the ack code when ok:false', async () => {
    const { client, serverSocket } = await connectedHarness()

    serverSocket.on('message', (raw) => {
      const parsed: unknown = JSON.parse(String(raw))
      if (!isWsEnvelope(parsed) || parsed.event === 'ack') return
      serverSocket.send(
        JSON.stringify(
          buildEnvelope('ack', { ok: false, code: 'BAD_INPUT' }, parsed.id),
        ),
      )
    })

    await expect(client.request('add')).rejects.toMatchObject({
      code: 'BAD_INPUT',
    })
  })

  it('rejects request() on timeout when no ack arrives', async () => {
    const { client } = await connectedHarness()

    await expect(
      client.request('silence', undefined, { timeout: 40 }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('rejects request() immediately with NOT_OPEN when not connected', async () => {
    const server = await startServer()
    const client = createWsClient({
      url: `ws://127.0.0.1:${server.port}`,
      webSocketImpl: NodeWebSocket as unknown as typeof WebSocket,
    })
    onTestFinished(async () => {
      client.close()
      await server.close()
    })

    expect(client.state).toBe('connecting')
    await expect(client.request('x')).rejects.toMatchObject({
      code: 'NOT_OPEN',
    })
  })

  it('drops send() silently once the client is closed', async () => {
    const { client, serverSocket } = await connectedHarness()

    const messages: string[] = []
    serverSocket.on('message', (raw) => messages.push(String(raw)))

    client.close()
    await waitForState(client, 'closed')

    expect(() => client.send('after-close', { x: 1 })).not.toThrow()
    await delay(50)
    expect(messages).toHaveLength(0)
  })

  it('reconnects with backoff after the server closes the connection', async () => {
    const { server, client, serverSocket } = await connectedHarness({
      backoff: { baseMs: 10, maxMs: 20 },
    })

    const secondConnection = server.nextConnection()
    serverSocket.close()

    await waitForState(client, 'reconnecting')
    await secondConnection
    await waitForState(client, 'open')
  })

  it('reconnects when a ping request times out', async () => {
    const { client } = await connectedHarness({
      pingIntervalMs: 20,
      pingTimeoutMs: 20,
      backoff: { baseMs: 10, maxMs: 20 },
    })

    await waitForState(client, 'reconnecting')
  })

  it('ignores malformed frames without disrupting later dispatch', async () => {
    const { client, serverSocket } = await connectedHarness()

    const received: unknown[] = []
    client.on('greet', (payload) => received.push(payload))

    serverSocket.send('not json at all')
    serverSocket.send(JSON.stringify({ foo: 'bar' }))
    serverSocket.send(JSON.stringify({ v: 'nope', event: 'greet' }))
    await delay(30)
    expect(received).toEqual([])
    expect(client.state).toBe('open')

    serverSocket.send(JSON.stringify(buildEnvelope('greet', { ok: true })))
    await delay(30)
    expect(received).toEqual([{ ok: true }])
  })

  it('close() rejects pending requests and prevents reconnection', async () => {
    const { client } = await connectedHarness({
      backoff: { baseMs: 10, maxMs: 20 },
    })

    const pending = client.request('silence', undefined, { timeout: 5000 })
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'CLOSED',
    })

    client.close()
    await assertion
    expect(client.state).toBe('closed')

    await delay(80)
    expect(client.state).toBe('closed')
  })
})

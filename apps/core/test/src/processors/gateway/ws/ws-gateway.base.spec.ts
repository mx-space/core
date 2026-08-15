import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WsConnection } from '~/processors/gateway/ws/ws.types'
import { WsGatewayBase } from '~/processors/gateway/ws/ws-gateway.base'

const HEARTBEAT_INTERVAL_MS = 30_000

class TestGateway extends WsGatewayBase {
  constructor(bus: any, presence: any) {
    super('web', bus, presence)
  }

  broadcast() {}

  track(ws: any): WsConnection {
    return this.trackConnection(ws)
  }
}

function createFakeWs() {
  return {
    OPEN: 1,
    readyState: 1,
    on: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
  }
}

function createFakes() {
  return {
    bus: { register: vi.fn(() => () => undefined), publish: vi.fn() },
    presence: {
      removeConnection: vi.fn(async () => undefined),
      leaveRoom: vi.fn(async () => undefined),
      registerLocalIndex: vi.fn(),
    },
  }
}

describe('WsGatewayBase heartbeat sweep', () => {
  let gateway: TestGateway

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    gateway.onModuleDestroy()
    vi.useRealTimers()
  })

  it('terminates a connection that never pongs on the second sweep', () => {
    const fakes = createFakes()
    gateway = new TestGateway(fakes.bus, fakes.presence)
    gateway.onModuleInit()

    const ws = createFakeWs()
    gateway.track(ws as any)

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    expect(ws.ping).toHaveBeenCalledTimes(1)
    expect(ws.terminate).not.toHaveBeenCalled()

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    expect(ws.terminate).toHaveBeenCalledTimes(1)
    expect(ws.ping).toHaveBeenCalledTimes(1)
  })

  it('keeps a connection alive across sweeps while it keeps ponging', () => {
    const fakes = createFakes()
    gateway = new TestGateway(fakes.bus, fakes.presence)
    gateway.onModuleInit()

    const ws = createFakeWs()
    let pongHandler: (() => void) | undefined
    ws.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'pong') pongHandler = handler
    })
    gateway.track(ws as any)

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    expect(ws.ping).toHaveBeenCalledTimes(1)
    pongHandler?.()

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    expect(ws.ping).toHaveBeenCalledTimes(2)
    expect(ws.terminate).not.toHaveBeenCalled()
    pongHandler?.()

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    expect(ws.ping).toHaveBeenCalledTimes(3)
    expect(ws.terminate).not.toHaveBeenCalled()
  })

  it('skips a connection that already closed before the sweep runs', () => {
    const fakes = createFakes()
    gateway = new TestGateway(fakes.bus, fakes.presence)
    gateway.onModuleInit()

    const ws = createFakeWs()
    gateway.track(ws as any)
    ws.readyState = 3

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
    expect(ws.ping).not.toHaveBeenCalled()
    expect(ws.terminate).not.toHaveBeenCalled()
  })
})

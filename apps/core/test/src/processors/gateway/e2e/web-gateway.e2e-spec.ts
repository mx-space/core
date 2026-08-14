import { randomUUID } from 'node:crypto'

import { redisHelper } from 'test/helper/redis-mock.helper'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'

import {
  createGatewayApp,
  type GatewayTestApp,
  WsTestClient,
} from './gateway-e2e.harness'

// The full gateway suite runs many concurrent real listeners; give each test
// headroom above the harness's own per-frame wait bound.
vi.setConfig({ testTimeout: 15_000 })

describe('WebEventsGateway e2e', () => {
  let testApp: GatewayTestApp
  let preTestClientCount = 0

  beforeAll(async () => {
    const helper = await redisHelper
    const opts = helper.CacheService.getClient().options
    testApp = await createGatewayApp({
      port: opts.port as number,
      host: opts.host as string,
    })
  })

  afterAll(async () => {
    await testApp.close()
  })

  beforeEach(async () => {
    preTestClientCount = await testApp.webGateway.getCurrentClientCount()
  })

  afterEach(async () => {
    // Each test closes its own clients, but server-side presence cleanup runs
    // asynchronously after the local close event; settle it here so the next
    // test's online-count baseline is never contaminated by a straggler.
    await vi.waitFor(async () => {
      expect(await testApp.webGateway.getCurrentClientCount()).toBe(
        preTestClientCount,
      )
    })
  })

  it('greets with gateway.connect and a direct visitor.online payload on connect', async () => {
    const client = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-greet&lang=zh'),
    )
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
      const online = await client.waitFor(
        (e) => e.event === BusinessEvents.VISITOR_ONLINE,
      )
      expect(online.payload).toMatchObject({
        online: expect.any(Number),
        timestamp: expect.any(String),
      })
    } finally {
      await client.closeAndWait()
    }
  })

  it('counts online clients by unique session id', async () => {
    const baseline = preTestClientCount

    const a = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-dup'),
    )
    const b = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-dup'),
    )
    try {
      await a.waitFor((e) => e.event === BusinessEvents.VISITOR_ONLINE)
      await b.waitFor((e) => e.event === BusinessEvents.VISITOR_ONLINE)

      const c = await WsTestClient.connect(
        testApp.webUrl('socket_session_id=s-dup'),
      )
      try {
        const online = await c.waitFor(
          (e) => e.event === BusinessEvents.VISITOR_ONLINE,
        )
        expect((online.payload as { online: number }).online).toBe(baseline + 1)
      } finally {
        await c.closeAndWait()
      }
    } finally {
      await a.closeAndWait()
      await b.closeAndWait()
    }
  })

  it('delivers a room broadcast only to a joined client', async () => {
    const joined = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-room-1'),
    )
    const other = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-room-2'),
    )
    try {
      const joinId = randomUUID()
      joined.send('room.join', { room: 'room-A' }, joinId)
      const ack = await joined.waitForAck(joinId)
      expect(ack.payload).toMatchObject({ ok: true })

      testApp.webGateway.broadcast(
        BusinessEvents.CONTENT_REFRESH,
        { tick: 1 },
        { rooms: ['room-A'] },
      )

      const received = await joined.waitFor(
        (e) => e.event === BusinessEvents.CONTENT_REFRESH,
      )
      expect(received.payload).toEqual({ tick: 1 })

      await other.assertNotDelivered(
        (e) => e.event === BusinessEvents.CONTENT_REFRESH,
      )
    } finally {
      await joined.closeAndWait()
      await other.closeAndWait()
    }
  })

  it('stops delivering to a room after room.leave', async () => {
    const client = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-leave'),
    )
    try {
      const joinId = randomUUID()
      client.send('room.join', { room: 'room-B' }, joinId)
      await client.waitForAck(joinId)

      const leaveId = randomUUID()
      client.send('room.leave', { room: 'room-B' }, leaveId)
      const ack = await client.waitForAck(leaveId)
      expect(ack.payload).toMatchObject({ ok: true })

      testApp.webGateway.broadcast(
        BusinessEvents.CONTENT_REFRESH,
        { tick: 2 },
        { rooms: ['room-B'] },
      )
      await client.assertNotDelivered(
        (e) =>
          e.event === BusinessEvents.CONTENT_REFRESH &&
          (e.payload as { tick?: number })?.tick === 2,
      )
    } finally {
      await client.closeAndWait()
    }
  })

  it('lang.update moves the connection between lang rooms', async () => {
    const client = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-lang&lang=zh'),
    )
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)

      const updateId = randomUUID()
      client.send('lang.update', { lang: 'en' }, updateId)
      const ack = await client.waitForAck(updateId)
      expect(ack.payload).toMatchObject({ ok: true })

      testApp.webGateway.broadcast(
        BusinessEvents.CONTENT_REFRESH,
        { lang: 'en' },
        { rooms: ['lang:en'] },
      )
      await client.waitFor(
        (e) =>
          e.event === BusinessEvents.CONTENT_REFRESH &&
          (e.payload as { lang?: string })?.lang === 'en',
      )

      testApp.webGateway.broadcast(
        BusinessEvents.CONTENT_REFRESH,
        { lang: 'zh' },
        { rooms: ['lang:zh'] },
      )
      await client.assertNotDelivered(
        (e) =>
          e.event === BusinessEvents.CONTENT_REFRESH &&
          (e.payload as { lang?: string })?.lang === 'zh',
      )
    } finally {
      await client.closeAndWait()
    }
  })

  it('broadcasts visitor.offline with the leaving session id on disconnect', async () => {
    const leaver = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-leaver'),
    )
    const stayer = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-stayer'),
    )
    try {
      await leaver.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
      await stayer.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)

      await leaver.closeAndWait()

      const offline = await stayer.waitFor(
        (e) =>
          e.event === BusinessEvents.VISITOR_OFFLINE &&
          (e.payload as { sessionId?: string })?.sessionId === 's-leaver',
      )
      expect((offline.payload as { sessionId?: string }).sessionId).toBe(
        's-leaver',
      )
    } finally {
      await stayer.closeAndWait()
    }
  })

  it('survives malformed and unknown frames, still acking a ping afterwards', async () => {
    const client = await WsTestClient.connect(
      testApp.webUrl('socket_session_id=s-survive'),
    )
    try {
      await client.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)

      client.sendRaw('not json at all {{{')
      client.send('totally.unknown', { foo: 1 }, 'unknown-1')

      const pingId = randomUUID()
      client.send('ping', undefined, pingId)
      const ack = await client.waitForAck(pingId)
      expect(ack.payload).toMatchObject({ ok: true })

      expect(client.frames.find((f) => f.id === 'unknown-1')).toBeUndefined()
    } finally {
      await client.closeAndWait()
    }
  })
})

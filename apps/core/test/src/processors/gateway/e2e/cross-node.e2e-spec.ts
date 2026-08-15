import { randomUUID } from 'node:crypto'

import { redisHelper } from 'test/helper/redis-mock.helper'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { RoomSubsService } from '~/processors/task-queue/task-queue.room-subs.service'
import { getRedisKey } from '~/utils/redis.util'

import {
  createGatewayApp,
  type GatewayTestApp,
  type RedisConn,
  WsTestClient,
} from './gateway-e2e.harness'

vi.setConfig({ testTimeout: 15_000 })

describe('gateway cross-node e2e', () => {
  let redisConn: RedisConn
  let appA: GatewayTestApp
  let appB: GatewayTestApp

  beforeAll(async () => {
    const helper = await redisHelper
    const opts = helper.CacheService.getClient().options
    redisConn = { port: opts.port as number, host: opts.host as string }
    appA = await createGatewayApp(redisConn)
    appB = await createGatewayApp(redisConn)
  })

  afterAll(async () => {
    await appA.close()
    await appB.close()
  })

  it('delivers a bus broadcast issued on B to a room member connected on A', async () => {
    const client = await WsTestClient.connect(
      appA.webUrl('socket_session_id=cross-1'),
    )
    try {
      const joinId = randomUUID()
      client.send('room.join', { room: 'cross-room' }, joinId)
      const ack = await client.waitForAck(joinId)
      expect(ack.payload).toMatchObject({ ok: true })

      appB.webGateway.broadcast(
        BusinessEvents.CONTENT_REFRESH,
        { from: 'B' },
        { rooms: ['cross-room'] },
      )

      const received = await client.waitFor(
        (e) => e.event === BusinessEvents.CONTENT_REFRESH,
      )
      expect(received.payload).toEqual({ from: 'B' })

      const membersFromA = await appA.webGateway.getSocketsOfRoom('cross-room')
      const membersFromB = await appB.webGateway.getSocketsOfRoom('cross-room')
      expect(membersFromB).toEqual(membersFromA)
      expect(membersFromB).toHaveLength(1)
    } finally {
      await client.closeAndWait()
    }
  })

  it('reclaims A conn/room entries from B once A node heartbeat is gone', async () => {
    const client = await WsTestClient.connect(
      appA.webUrl('socket_session_id=cross-dead'),
    )
    try {
      const joinId = randomUUID()
      client.send('room.join', { room: 'cross-dead-room' }, joinId)
      await client.waitForAck(joinId)

      const membersBefore =
        await appB.webGateway.getSocketsOfRoom('cross-dead-room')
      expect(membersBefore).toHaveLength(1)

      await appB.redisClient.del(
        getRedisKey(RedisKeys.WsNode, appA.presence.nodeId),
      )
      await appB.presence.sweepOnce()

      const membersAfter = await appB.presence.roomMemberIds(
        'web',
        'cross-dead-room',
      )
      expect(membersAfter).toHaveLength(0)

      const connIds = await appB.presence.connectionIds('web')
      expect(connIds).not.toContain(membersBefore[0].id)
    } finally {
      await client.closeAndWait()
    }
  })

  it('graceful presence shutdown reclaims its own conn and room entries', async () => {
    const appC = await createGatewayApp(redisConn)
    const client = await WsTestClient.connect(
      appC.webUrl('socket_session_id=cross-shutdown'),
    )
    try {
      client.send('room.join', { room: 'cross-shutdown-room' }, 'shutdown-join')
      await client.waitForAck('shutdown-join')

      const membersBefore = await appB.presence.roomMemberIds(
        'web',
        'cross-shutdown-room',
      )
      expect(membersBefore).toHaveLength(1)

      await appC.presence.onModuleDestroy()

      const membersAfter = await appB.presence.roomMemberIds(
        'web',
        'cross-shutdown-room',
      )
      expect(membersAfter).toHaveLength(0)
      const connIds = await appB.presence.connectionIds('web')
      expect(connIds).not.toContain(membersBefore[0])
    } finally {
      await client.closeAndWait()
      await appC.close()
    }
  })

  it('unsubscribe drops the local roomSubs entry while a remote member remains', async () => {
    const room = 'ai-task:detail:CROSS9'
    const key = getRedisKey(`task-queue:room-subs:${room}` as any)
    const subsA = appA.moduleRef.get(RoomSubsService)
    const subsB = appB.moduleRef.get(RoomSubsService)

    appA.authService.getSessionUserFromHeaders.mockResolvedValueOnce({
      user: { id: 'owner-a', role: 'owner' },
      session: { token: 'tok-a' },
    })
    appB.authService.getSessionUserFromHeaders.mockResolvedValueOnce({
      user: { id: 'owner-b', role: 'owner' },
      session: { token: 'tok-b' },
    })

    const clientA = await WsTestClient.connect(appA.adminUrl(), {
      headers: { cookie: 'better-auth.session=a' },
    })
    const clientB = await WsTestClient.connect(appB.adminUrl(), {
      headers: { cookie: 'better-auth.session=b' },
    })
    try {
      await clientA.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)
      await clientB.waitFor((e) => e.event === BusinessEvents.GATEWAY_CONNECT)

      clientA.send('ai_task.subscribe', { taskId: 'CROSS9' }, 'sub-a')
      await clientA.waitForAck('sub-a')
      clientB.send('ai_task.subscribe', { taskId: 'CROSS9' }, 'sub-b')
      await clientB.waitForAck('sub-b')

      expect(await appA.redisClient.smembers(key)).toEqual(
        expect.arrayContaining([subsA.podId, subsB.podId]),
      )

      clientA.send('ai_task.unsubscribe', { taskId: 'CROSS9' }, 'unsub-a')
      await clientA.waitForAck('unsub-a')

      const remaining = await appA.redisClient.smembers(key)
      expect(remaining).not.toContain(subsA.podId)
      expect(remaining).toContain(subsB.podId)
    } finally {
      await clientA.closeAndWait()
      await clientB.closeAndWait()
    }
  })
})

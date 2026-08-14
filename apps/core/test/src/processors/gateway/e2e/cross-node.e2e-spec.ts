import { randomUUID } from 'node:crypto'

import { redisHelper } from 'test/helper/redis-mock.helper'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

import {
  createGatewayApp,
  type GatewayTestApp,
  WsTestClient,
} from './gateway-e2e.harness'

vi.setConfig({ testTimeout: 15_000 })

describe('gateway cross-node e2e', () => {
  let appA: GatewayTestApp
  let appB: GatewayTestApp

  beforeAll(async () => {
    const helper = await redisHelper
    const opts = helper.CacheService.getClient().options
    const conn = { port: opts.port as number, host: opts.host as string }
    appA = await createGatewayApp(conn)
    appB = await createGatewayApp(conn)
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
})

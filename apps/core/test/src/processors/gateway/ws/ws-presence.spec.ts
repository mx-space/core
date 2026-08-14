import IORedis, { type Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RedisKeys } from '~/constants/cache.constant'
import { WsPresenceService } from '~/processors/gateway/ws/ws-presence.service'
import { getRedisKey } from '~/utils/redis.util'

import { redisHelper } from '../../../../helper/redis-mock.helper'

function buildPresence(client: Redis): WsPresenceService {
  const redisService = { getClient: () => client } as any
  return new WsPresenceService(redisService)
}

describe('WsPresenceService', () => {
  let client: Redis
  let nodeA: WsPresenceService
  let nodeB: WsPresenceService

  beforeAll(async () => {
    const helper = await redisHelper
    const upstream = helper.CacheService.getClient()
    const opts = upstream.options
    client = new IORedis(opts.port as number, opts.host as string)
    nodeA = buildPresence(client)
    nodeB = buildPresence(client)
    await nodeA.onModuleInit()
    await nodeB.onModuleInit()
  })

  afterAll(async () => {
    await nodeA.onModuleDestroy()
    await nodeB.onModuleDestroy()
    await client.quit()
  })

  it('assigns each instance a distinct nodeId', () => {
    expect(nodeA.nodeId).not.toBe(nodeB.nodeId)
  })

  it('addConnection/connectionIds bookkeeping is visible cross-instance', async () => {
    await nodeA.addConnection('web', 'conn-a1')
    await nodeB.addConnection('web', 'conn-b1')

    const ids = (await nodeA.connectionIds('web')).sort()
    expect(ids).toEqual(['conn-a1', 'conn-b1'])

    await nodeA.removeConnection('web', 'conn-a1')
    await nodeB.removeConnection('web', 'conn-b1')
  })

  it('joinRoom bookkeeping is visible cross-instance and reflected in roomSizes', async () => {
    await nodeA.joinRoom('web', 'roomX', 'conn-a2')
    await nodeB.joinRoom('web', 'roomX', 'conn-b2')

    const members = (await nodeA.roomMemberIds('web', 'roomX')).sort()
    expect(members).toEqual(['conn-a2', 'conn-b2'])

    const sizes = await nodeA.roomSizes('web')
    expect(sizes.roomX).toBe(2)

    await nodeA.leaveRoom('web', 'roomX', 'conn-a2')
    await nodeB.leaveRoom('web', 'roomX', 'conn-b2')
  })

  it('leaveRoom evicts the room hash and rooms-set entry once the room is empty', async () => {
    await nodeA.joinRoom('web', 'roomY', 'conn-a3')

    await nodeA.leaveRoom('web', 'roomY', 'conn-a3')

    expect(await nodeA.roomMemberIds('web', 'roomY')).toEqual([])
    const roomsSetKey = getRedisKey(RedisKeys.WsRooms, 'web')
    expect(await client.sismember(roomsSetKey, 'roomY')).toBe(0)
    const roomHashKey = getRedisKey(RedisKeys.WsRoom, 'web', 'roomY')
    expect(await client.exists(roomHashKey)).toBe(0)
  })

  it('leaveRoom keeps a room alive if another member is present, and cleans up once truly empty', async () => {
    await nodeA.joinRoom('web', 'roomZ', 'm1')
    await client.hset(
      getRedisKey(RedisKeys.WsRoom, 'web', 'roomZ'),
      'm2',
      nodeB.nodeId,
    )

    await nodeA.leaveRoom('web', 'roomZ', 'm1')

    expect(await nodeA.roomMemberIds('web', 'roomZ')).toEqual(['m2'])
    const roomsSetKey = getRedisKey(RedisKeys.WsRooms, 'web')
    const roomHashKey = getRedisKey(RedisKeys.WsRoom, 'web', 'roomZ')
    expect(await client.sismember(roomsSetKey, 'roomZ')).toBe(1)
    expect(await client.exists(roomHashKey)).toBe(1)

    await nodeB.leaveRoom('web', 'roomZ', 'm2')

    expect(await nodeA.roomMemberIds('web', 'roomZ')).toEqual([])
    expect(await client.sismember(roomsSetKey, 'roomZ')).toBe(0)
    expect(await client.exists(roomHashKey)).toBe(0)
  })

  describe('sweepOnce', () => {
    it('removes a dead node conns/room fields and Socket metadata, keeping the live node intact', async () => {
      await nodeA.addConnection('web', 'dead-conn')
      await nodeB.addConnection('web', 'live-conn')
      await nodeA.joinRoom('web', 'sweepRoom', 'dead-conn')
      await nodeB.joinRoom('web', 'sweepRoom', 'live-conn')
      await client.hset(
        getRedisKey(RedisKeys.Socket),
        'dead-conn',
        JSON.stringify({}),
      )
      await client.hset(
        getRedisKey(RedisKeys.Socket),
        'live-conn',
        JSON.stringify({}),
      )

      await client.sadd(getRedisKey(RedisKeys.WsNodes), nodeA.nodeId)
      await client.del(getRedisKey(RedisKeys.WsNode, nodeA.nodeId))

      await nodeA.sweepOnce()

      expect(await nodeA.connectionIds('web')).toEqual(['live-conn'])
      expect(await nodeA.roomMemberIds('web', 'sweepRoom')).toEqual([
        'live-conn',
      ])

      const socketHash = await client.hgetall(getRedisKey(RedisKeys.Socket))
      expect(socketHash['dead-conn']).toBeUndefined()
      expect(socketHash['live-conn']).toBeDefined()

      const nodesSetMembers = await client.smembers(
        getRedisKey(RedisKeys.WsNodes),
      )
      expect(nodesSetMembers).not.toContain(nodeA.nodeId)
      expect(nodesSetMembers).toContain(nodeB.nodeId)

      await nodeB.removeConnection('web', 'live-conn')
      await nodeB.leaveRoom('web', 'sweepRoom', 'live-conn')
      await client.hdel(getRedisKey(RedisKeys.Socket), 'live-conn')
    })

    it('prunes the rooms set when the dead node was the last member', async () => {
      await nodeA.addConnection('admin', 'solo-conn')
      await nodeA.joinRoom('admin', 'soloRoom', 'solo-conn')

      await client.sadd(getRedisKey(RedisKeys.WsNodes), nodeA.nodeId)
      await client.del(getRedisKey(RedisKeys.WsNode, nodeA.nodeId))

      await nodeA.sweepOnce()

      const roomsSetKey = getRedisKey(RedisKeys.WsRooms, 'admin')
      expect(await client.sismember(roomsSetKey, 'soloRoom')).toBe(0)
      const roomHashKey = getRedisKey(RedisKeys.WsRoom, 'admin', 'soloRoom')
      expect(await client.exists(roomHashKey)).toBe(0)
    })
  })
})

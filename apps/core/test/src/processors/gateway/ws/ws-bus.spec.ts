import IORedis, { type Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { RedisKeys } from '~/constants/cache.constant'
import type { WsBusFrame } from '~/processors/gateway/ws/ws.types'
import { WsBusService } from '~/processors/gateway/ws/ws-bus.service'
import { getRedisKey } from '~/utils/redis.util'

import { redisHelper } from '../../../../helper/redis-mock.helper'

function buildBus(client: Redis): WsBusService {
  const redisService = {
    getClient: () => client,
    duplicateClient: () => client.duplicate(),
  } as any
  return new WsBusService(redisService)
}

describe('WsBusService', () => {
  let clientA: Redis
  let clientB: Redis
  let busA: WsBusService
  let busB: WsBusService

  beforeAll(async () => {
    const helper = await redisHelper
    const upstream = helper.CacheService.getClient()
    const opts = upstream.options
    clientA = new IORedis(opts.port as number, opts.host as string)
    clientB = new IORedis(opts.port as number, opts.host as string)
    busA = buildBus(clientA)
    busB = buildBus(clientB)
    await busA.onModuleInit()
    await busB.onModuleInit()
  })

  afterAll(async () => {
    await busA.onModuleDestroy()
    await busB.onModuleDestroy()
    await clientA.quit()
    await clientB.quit()
  })

  it('publish from A delivers the frame to B registered ns handler', async () => {
    const received: WsBusFrame[] = []
    busB.register('web', (frame) => received.push(frame))

    busA.publish({ ns: 'web', event: 'test.event', payload: { hello: 1 } })

    await vi.waitFor(() => expect(received).toHaveLength(1))
    expect(received[0]).toEqual({
      ns: 'web',
      event: 'test.event',
      payload: { hello: 1 },
    })
  })

  it('publish self-delivers to the publishing instance own registered handler', async () => {
    const received: WsBusFrame[] = []
    busA.register('admin', (frame) => received.push(frame))

    busA.publish({ ns: 'admin', event: 'self.event' })

    await vi.waitFor(() => expect(received).toHaveLength(1))
    expect(received[0].event).toBe('self.event')
  })

  it('a handler registered for one ns never receives frames of another ns', async () => {
    const webReceived: WsBusFrame[] = []
    const adminReceived: WsBusFrame[] = []
    busB.register('web', (frame) => webReceived.push(frame))
    busB.register('admin', (frame) => adminReceived.push(frame))

    busA.publish({ ns: 'web', event: 'ns.isolation' })

    await vi.waitFor(() => expect(webReceived).toHaveLength(1))
    expect(adminReceived).toHaveLength(0)
  })

  it('unregister stops further delivery to that handler', async () => {
    const received: WsBusFrame[] = []
    const unregister = busB.register('web', (frame) => received.push(frame))
    unregister()

    busA.publish({ ns: 'web', event: 'after.unregister' })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(received).toHaveLength(0)
  })

  it('drops a malformed (non-JSON) frame without throwing or dispatching', async () => {
    const received: WsBusFrame[] = []
    busB.register('web', (frame) => received.push(frame))

    await clientA.publish(getRedisKey(RedisKeys.WsBus), 'not-json{{{')

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(received).toHaveLength(0)
  })
})

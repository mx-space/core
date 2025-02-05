import IORedis from 'ioredis'
import RedisMemoryServer from 'redis-memory-server'
import type { Redis } from 'ioredis'

import { CacheService } from '~/processors/redis/cache.service'

export class MockCacheService {
  private client: Redis
  constructor(port: number, host: string) {
    this.client = new IORedis(port, host)
  }

  private get redisClient() {
    return this.client
  }

  public get(key) {
    return this.client.get(key)
  }

  public set(key, value: any) {
    return this.client.set(key, value)
  }

  public getClient() {
    return this.redisClient
  }
}

const createMockRedis = async () => {
  const redisServer = new RedisMemoryServer({})

  const redisHost = await redisServer.getHost()
  const redisPort = await redisServer.getPort()

  const cacheService = new MockCacheService(redisPort, redisHost)

  return {
    connect: () => null,
    CacheService: cacheService,
    RedisService: cacheService,

    token: CacheService,

    async close() {
      await cacheService.getClient().flushall()
      await cacheService.getClient().quit()
      await redisServer.stop()
    },
  }
}

export const redisHelper = createMockRedis()

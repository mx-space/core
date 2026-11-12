import type { Redis } from 'ioredis'
import IORedis from 'ioredis'

import { CacheService } from '~/processors/redis/cache.service'

import { findRedisSystemBinary, startTestRedis } from './redis-test-server'

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

  public waitForReady() {
    return Promise.resolve()
  }

  public isReady() {
    return true
  }

  public getStatus() {
    return 'ready'
  }
}

const createMockRedis = async () => {
  const systemBinary = findRedisSystemBinary()

  const redisServer = await startTestRedis({
    binary: systemBinary ? { systemBinary } : undefined,
  })

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

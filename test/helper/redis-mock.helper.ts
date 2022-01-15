import IORedis from 'ioredis'
import RedisMemoryServer from 'redis-memory-server'
import { CacheKeys } from '~/constants/cache.constant'

export class MockCacheService {
  private client: IORedis.Redis
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

  public clearAggregateCache() {
    return Promise.all([
      this.redisClient.del(CacheKeys.RSS),
      this.redisClient.del(CacheKeys.RSSXmlCatch),
      this.redisClient.del(CacheKeys.AggregateCatch),
      this.redisClient.del(CacheKeys.SiteMapCatch),
      this.redisClient.del(CacheKeys.SiteMapXmlCatch),
    ])
  }
}

export const createMockRedis = async () => {
  const redisServer = new RedisMemoryServer()

  const redisHost = await redisServer.getHost()
  const redisPort = await redisServer.getPort()

  const service = new MockCacheService(redisPort, redisHost)

  return {
    service,
    async close() {
      await service.getClient().quit()
      await redisServer.stop()
    },
  }
}

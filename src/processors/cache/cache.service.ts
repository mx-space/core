import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { Redis } from 'ioredis'

// Cache 客户端管理器

// 获取器
export type TCacheKey = string
export type TCacheResult<T> = Promise<T>

/**
 * @class CacheService
 * @classdesc 承载缓存服务
 * @example CacheService.get(CacheKey).then()
 * @example CacheService.set(CacheKey).then()
 */
@Injectable()
export class CacheService {
  private cache!: Cache
  private logger = new Logger(CacheService.name)

  constructor(@Inject(CACHE_MANAGER) cache: Cache) {
    this.cache = cache
    this.redisClient.on('ready', () => {
      this.logger.log('Redis 已准备好！')
    })
  }

  private get redisClient(): Redis {
    // @ts-expect-error
    return this.cache.store.getClient()
  }

  public get<T>(key: TCacheKey): TCacheResult<T> {
    return this.cache.get(key)
  }

  public set<T>(
    key: TCacheKey,
    value: any,
    options?: { ttl: number },
  ): TCacheResult<T> {
    return this.cache.set(key, value, options)
  }

  public async publish(event: string, data: any) {
    const { redisSubPub } = await import('../../utils/redis-subpub.util')
    return redisSubPub.publish(event, data)
  }

  public async subscribe(event: string, callback: (data: any) => void) {
    const { redisSubPub } = await import('../../utils/redis-subpub.util')

    return redisSubPub.subscribe(event, callback)
  }

  public async unsubscribe(event: string, callback: (data: any) => void) {
    const { redisSubPub } = await import('../../utils/redis-subpub.util')

    return redisSubPub.unsubscribe(event, callback)
  }

  public getClient() {
    return this.redisClient
  }
}

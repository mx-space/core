import { Cache } from 'cache-manager'
import { Redis } from 'ioredis'

import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common'

import { getRedisKey } from '~/utils/redis.util'

import { RedisSubPub } from '../../utils/redis-subpub.util'

// Cache 客户端管理器

// 获取器
export type TCacheKey = string
export type TCacheResult<T> = Promise<T | undefined>

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

  private _redisSubPub: RedisSubPub

  get redisSubPub(): RedisSubPub {
    return (
      this._redisSubPub ??
      (this._redisSubPub = require('../../utils/redis-subpub.util').redisSubPub)
    )
  }
  public async publish(event: string, data: any) {
    return this.redisSubPub.publish(event, data)
  }

  public async subscribe(event: string, callback: (data: any) => void) {
    return this.redisSubPub.subscribe(event, callback)
  }

  public async unsubscribe(event: string, callback: (data: any) => void) {
    return this.redisSubPub.unsubscribe(event, callback)
  }

  public getClient() {
    return this.redisClient
  }

  public async cleanCatch() {
    const redis = this.getClient()
    const keys: string[] = await redis.keys('mx-api-cache:*')
    await Promise.all(keys.map((key) => redis.del(key)))

    return
  }

  public async cleanAllRedisKey() {
    const redis = this.getClient()
    const keys: string[] = await redis.keys(getRedisKey('*'))

    await Promise.all(keys.map((key) => redis.del(key)))

    return
  }
}

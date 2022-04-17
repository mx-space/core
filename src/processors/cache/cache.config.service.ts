/**
 * Cache config service.
 * @file Cache 配置器
 * @module processor/cache/config.service
 * @author Surmon <https://github.com/surmon-china>
 */
import redisStore from 'cache-manager-ioredis'
import type { RedisOptions } from 'ioredis'

import type { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import { REDIS } from '~/app.config'

@Injectable()
export class CacheConfigService implements CacheOptionsFactory {
  // 缓存配置
  public createCacheOptions(): CacheModuleOptions {
    const redisOptions: RedisOptions = {
      host: REDIS.host as string,
      port: REDIS.port as number,
    }
    if (REDIS.password) {
      redisOptions.password = REDIS.password as any
    }
    return {
      store: redisStore,
      ttl: REDIS.ttl ?? undefined,
      // https://github.com/dabroek/node-cache-manager-redis-store/blob/master/CHANGELOG.md#breaking-changes
      // Any value (undefined | null) return true (cacheable) after redisStore v2.0.0
      is_cacheable_value: () => true,
      max: REDIS.max,
      ...redisOptions,
    }
  }
}

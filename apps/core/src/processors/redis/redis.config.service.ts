/**
 * Cache config service.
 * @file Cache 配置器
 * @module processor/redis/redis.config.service
 * @author Innei <https://github.com/innei>
 */

import type {
  CacheModuleOptions,
  CacheOptionsFactory,
} from '@nestjs/cache-manager'

import Keyv from '@keyv/redis'
import { Injectable } from '@nestjs/common'

import { REDIS } from '~/app.config'

@Injectable()
export class RedisConfigService implements CacheOptionsFactory {
  // 缓存配置
  public createCacheOptions(): CacheModuleOptions {
    return {
      ttl: REDIS.ttl ?? undefined,
      max: REDIS.max,

      stores: [
        new Keyv({
          url: `redis://${REDIS.host}:${REDIS.port}`,
          password: REDIS.password as any,
        }),
      ],
    }
  }
}

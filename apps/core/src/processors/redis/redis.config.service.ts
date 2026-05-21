/**
 * Cache config service.
 * @file Cache configuration factory
 * @module processor/redis/redis.config.service
 * @author Innei <https://github.com/innei>
 */

import Keyv from '@keyv/redis'
import type {
  CacheModuleOptions,
  CacheOptionsFactory,
} from '@nestjs/cache-manager'
import { Injectable } from '@nestjs/common'

import { REDIS } from '~/app.config'

@Injectable()
export class RedisConfigService implements CacheOptionsFactory {
  // Cache configuration
  public createCacheOptions(): CacheModuleOptions {
    const url = REDIS.url ?? `redis://${REDIS.host}:${REDIS.port}`
    return {
      ttl: REDIS.ttl ?? undefined,
      max: REDIS.max,

      stores: [
        new Keyv({
          url,
          username: (REDIS as any).username,
          password: REDIS.password as any,
        }),
      ],
    }
  }
}

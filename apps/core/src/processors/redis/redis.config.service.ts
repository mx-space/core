/**
 * Cache config service.
 * @file Cache configuration factory
 * @module processor/redis/redis.config.service
 * @author Innei <https://github.com/innei>
 */

import type {
  CacheModuleOptions,
  CacheOptionsFactory,
} from '@nestjs/cache-manager'
import { Injectable } from '@nestjs/common'
import Keyv from 'keyv'

import { REDIS } from '~/app.config'

import { KeyvIoredisStore } from './keyv-ioredis.store'

@Injectable()
export class RedisConfigService implements CacheOptionsFactory {
  // Cache configuration
  public createCacheOptions(): CacheModuleOptions {
    return {
      ttl: REDIS.ttl ?? undefined,
      max: REDIS.max,

      stores: [
        new Keyv({ store: new KeyvIoredisStore(), useKeyPrefix: false }),
      ],
    }
  }
}

/**
 * Cache module.
 * @file Global cache module
 * @module processor/cache/module
 */
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { Global, Module } from '@nestjs/common'

import { CacheService } from './cache.service'
import { ConfigVersionService } from './config-version.service'
import { RedisConfigService } from './redis.config.service'
import { RedisService } from './redis.service'

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      useClass: RedisConfigService,
      inject: [RedisConfigService],
    }),
  ],
  providers: [
    RedisConfigService,
    CacheService,
    ConfigVersionService,
    RedisService,
  ],
  exports: [CacheService, ConfigVersionService, RedisService],
})
export class RedisModule {}

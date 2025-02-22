/**
 * Cache module.
 * @file Cache 全局模块
 * @module processor/cache/module
 */
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { Global, Module } from '@nestjs/common'

import { CacheService } from './cache.service'
import { RedisConfigService } from './redis.config.service'
import { RedisService } from './redis.service'
import { SubPubBridgeService } from './subpub.service'

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
    SubPubBridgeService,
    RedisService,
  ],
  exports: [CacheService, SubPubBridgeService, RedisService],
})
export class RedisModule {}

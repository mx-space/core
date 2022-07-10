/**
 * Cache module.
 * @file Cache 全局模块
 * @module processor/cache/module
 * @author Surmon <https://github.com/surmon-china>
 */
import { Global, Module, CacheModule as NestCacheModule } from '@nestjs/common'

import { CacheService } from './cache.service'
import { RedisConfigService } from './redis.config.service'
import { SubPubBridgeService } from './subpub.service'

@Global()
@Module({
  imports: [
    // FIXME
    NestCacheModule.register({
      ...new RedisConfigService().createCacheOptions(),
    }),
  ],
  providers: [RedisConfigService, CacheService, SubPubBridgeService],
  exports: [CacheService, SubPubBridgeService],
})
export class RedisModule {}

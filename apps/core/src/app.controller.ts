import {
  BadRequestException,
  Get,
  HttpCode,
  Post,
  UseInterceptors,
} from '@nestjs/common'
import dayjs from 'dayjs'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { PKG } from '~/utils/pkg.util'

import { HttpCache } from './common/decorators/cache.decorator'
import { HTTPDecorators } from './common/decorators/http.decorator'
import type { IpRecord } from './common/decorators/ip.decorator'
import { IpLocation } from './common/decorators/ip.decorator'
import { AllowAllCorsInterceptor } from './common/interceptors/allow-all-cors.interceptor'
import { RedisKeys } from './constants/cache.constant'
import { ConfigsService } from './modules/configs/configs.service'
import { RedisService } from './processors/redis/redis.service'
import { getRedisKey } from './utils/redis.util'

@ApiController()
export class AppController {
  constructor(
    private readonly redisService: RedisService,
    private readonly configsService: ConfigsService,
  ) {}

  @Get('/uptime')
  @HttpCache.disable
  @HTTPDecorators.Bypass
  async getUptime() {
    const ts = (process.uptime() * 1000) | 0
    return {
      timestamp: ts,
      humanize: dayjs.duration(ts).locale('en').humanize(),
    }
  }

  @UseInterceptors(AllowAllCorsInterceptor)
  @Get(['/', '/info'])
  async appInfo() {
    return {
      name: PKG.name,
      author: PKG.author,
      version: isDev ? 'dev' : String(PKG.version),
      homepage: PKG.homepage,
      issues: PKG.issues,
    }
  }

  @Get('/ping')
  @UseInterceptors(AllowAllCorsInterceptor)
  ping(): 'pong' {
    return 'pong'
  }

  @Post('/like_this')
  @HttpCache.disable
  @HttpCode(204)
  async likeThis(@IpLocation() { ip }: IpRecord) {
    const redis = this.redisService.getClient()

    const isLikedBefore = await redis.sismember(
      getRedisKey(RedisKeys.LikeSite),
      ip,
    )
    if (isLikedBefore) {
      throw new BadRequestException('一天一次就够啦')
    } else {
      redis.sadd(getRedisKey(RedisKeys.LikeSite), ip)
    }

    await this.configsService.incrementOption('like')
  }

  @Get('/like_this')
  @HttpCache.disable
  async getLikeNumber() {
    return this.configsService.getOptionValue('like', 0)
  }

  @Get('/clean_catch')
  @HttpCache.disable
  @Auth()
  async cleanCatch() {
    await this.redisService.cleanCatch()
  }

  @Get('/clean_redis')
  @HttpCache.disable
  @Auth()
  async cleanAllRedisKey() {
    await this.redisService.cleanAllRedisKey()
  }
}

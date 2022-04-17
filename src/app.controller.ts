import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { InjectModel } from '~/transformers/model.transformer'

import PKG from '../package.json'
import { Auth } from './common/decorator/auth.decorator'
import { HttpCache } from './common/decorator/cache.decorator'
import type { IpRecord } from './common/decorator/ip.decorator'
import { IpLocation } from './common/decorator/ip.decorator'
import { AllowAllCorsInterceptor } from './common/interceptors/allow-all-cors.interceptor'
import { RedisKeys } from './constants/cache.constant'
import { OptionModel } from './modules/configs/configs.model'
import type { CacheService } from './processors/cache/cache.service'
import { getRedisKey } from './utils/redis.util'

@Controller()
@ApiTags('Root')
export class AppController {
  constructor(
    private readonly cacheService: CacheService,
    @InjectModel(OptionModel)
    private readonly optionModel: MongooseModel<OptionModel>,
  ) {}

  @UseInterceptors(AllowAllCorsInterceptor)
  @Get(['/', '/info'])
  async appInfo() {
    return {
      name: PKG.name,
      author: PKG.author,
      version: isDev ? 'dev' : PKG.version,
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
    const redis = this.cacheService.getClient()

    const isLikedBefore = await redis.sismember(
      getRedisKey(RedisKeys.LikeSite),
      ip,
    )
    if (isLikedBefore) {
      throw new BadRequestException('一天一次就够啦')
    } else {
      redis.sadd(getRedisKey(RedisKeys.LikeSite), ip)
    }

    await this.optionModel.updateOne(
      {
        name: 'like',
      },
      {
        $inc: {
          // @ts-ignore
          value: 1,
        },
      },
      { upsert: true },
    )

    return
  }

  @Get('/like_this')
  @HttpCache.disable
  async getLikeNumber() {
    const doc = await this.optionModel.findOne({ name: 'like' }).lean()
    return doc ? doc.value : 0
  }

  @Get('/clean_catch')
  @HttpCache.disable
  @Auth()
  async cleanCatch() {
    await this.cacheService.cleanCatch()
    return
  }

  @Get('/clean_redis')
  @HttpCache.disable
  @Auth()
  async cleanAllRedisKey() {
    await this.cacheService.cleanAllRedisKey()
    return
  }
}

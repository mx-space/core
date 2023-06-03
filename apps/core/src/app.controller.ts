import dayjs from 'dayjs'

import {
  BadRequestException,
  Get,
  HttpCode,
  OnModuleInit,
  Post,
  UseInterceptors,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { InjectModel } from '~/transformers/model.transformer'

import PKG from '../package.json'
import { DEMO_MODE } from './app.config'
import { HttpCache } from './common/decorators/cache.decorator'
import { HTTPDecorators } from './common/decorators/http.decorator'
import { IpLocation, IpRecord } from './common/decorators/ip.decorator'
import { AllowAllCorsInterceptor } from './common/interceptors/allow-all-cors.interceptor'
import { RedisKeys } from './constants/cache.constant'
import { OptionModel } from './modules/configs/configs.model'
import { CacheService } from './processors/redis/cache.service'
import { getRedisKey } from './utils/redis.util'

@ApiController()
export class AppController implements OnModuleInit {
  constructor(
    private readonly cacheService: CacheService,
    @InjectModel(OptionModel)
    private readonly optionModel: MongooseModel<OptionModel>,
  ) {}

  private upStartAt: number
  onModuleInit() {
    this.upStartAt = Date.now()
  }

  @Get('/uptime')
  @HttpCache.disable
  @HTTPDecorators.Bypass
  async getUptime() {
    const ts = Date.now() - this.upStartAt
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
      version: isDev ? 'dev' : `${DEMO_MODE ? 'demo/' : ''}${PKG.version}`,
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

import { CacheTTL, Get, Param, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorator/api-controller.decorator'
import { Auth } from '~/common/decorator/auth.decorator'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getRedisKey } from '~/utils/redis.util'

import { ConfigsService } from '../configs/configs.service'
import { GaodeMapLocationDto, GaodeMapSearchDto, IpDto } from './tool.dto'
import { ToolService } from './tool.service'

@ApiController('tools')
@ApiName
@Auth()
export class ToolController {
  constructor(
    private readonly toolService: ToolService,
    private readonly cacheService: CacheService,
    private readonly configs: ConfigsService,
  ) {}

  @Get('/ip/:ip')
  @HttpCache({ disable: true })
  async getIpInfo(@Param() params: IpDto) {
    const { ip } = params
    const redis = this.cacheService.getClient()

    try {
      const [ipFromRedis] = await redis.hmget(
        getRedisKey(RedisKeys.IpInfoMap),
        ip,
      )
      if (ipFromRedis) {
        return JSON.parse(ipFromRedis)
      }
    } catch {}
    const result = await this.toolService.getIp(ip)
    await redis.hmset(
      getRedisKey(RedisKeys.IpInfoMap),
      ip,
      JSON.stringify(result),
    )
    return result
  }

  @Get('geocode/location')
  @CacheTTL(60 * 60 * 24)
  async callGeocodeLocationApi(@Query() query: GaodeMapLocationDto) {
    const { latitude, longitude } = query
    const data = await this.toolService.getGeoLocationByGaode(
      longitude,
      latitude,
    )
    return data
  }

  @CacheTTL(10)
  @Get('geocode/search')
  async callGeocodeSearchApi(@Query() query: GaodeMapSearchDto) {
    let { keywords } = query
    keywords = keywords.replace(/\s/g, '|')
    return this.toolService.searchLocationByGaode(keywords)
  }
}

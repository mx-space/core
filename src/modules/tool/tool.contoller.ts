import { Controller, Get, Param } from '@nestjs/common'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getRedisKey } from '~/utils/redis.util'
import { IpDto } from './tool.dto'
import { ToolService } from './tool.service'

@Controller('tools')
@ApiName
export class ToolController {
  constructor(
    private readonly toolService: ToolService,
    private readonly cacheService: CacheService,
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
}

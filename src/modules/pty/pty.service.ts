import { Injectable } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { getRedisKey } from '~/utils'

@Injectable()
export class PTYService {
  constructor(private readonly cacheService: CacheService) {}

  async getLoginRecord() {
    const redis = this.cacheService.getClient()
    const keys = await redis.hkeys(getRedisKey(RedisKeys.PTYSession))

    const values = await Promise.all(
      keys.map(async (key) => {
        return redis.hget(getRedisKey(RedisKeys.PTYSession), key)
      }),
    )

    return values
      .filter(Boolean)
      .map((value: string) => {
        const [startTime, ip, endTime] = value.split(',') as [
          string,
          string,
          string | undefined,
        ]

        return {
          startTime: new Date(startTime),
          ip,
          endTime: endTime === '' ? null : endTime,
        }
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  }
}

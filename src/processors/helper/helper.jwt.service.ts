import cluster from 'cluster'
import dayjs from 'dayjs'
import { sign, verify } from 'jsonwebtoken'
import { machineIdSync } from 'node-machine-id'

import { Injectable, Logger } from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'

import { CLUSTER, SECURITY } from '~/app.config'
import { CronOnce } from '~/common/decorator/cron-once.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey, md5 } from '~/utils'

import { CacheService } from '../redis/cache.service'

@Injectable()
export class JWTService {
  private secret = ''
  private readonly logger: Logger
  constructor(private readonly cacheService: CacheService) {
    this.init()
    this.logger = new Logger(JWTService.name)
  }

  init() {
    if (this.secret) {
      return
    }

    const getMachineId = () => {
      const id = machineIdSync()

      if (isDev && cluster.isPrimary) {
        console.log(id)
      }
      return id
    }
    const secret =
      SECURITY.jwtSecret ||
      Buffer.from(getMachineId()).toString('base64').slice(0, 15) ||
      'asjhczxiucipoiopiqm2376'

    if (isDev && cluster.isPrimary) {
      console.log(secret)
    }
    if (!CLUSTER.enable || cluster.isPrimary) {
      console.log(
        'JWT Secret start with :',
        secret.slice(0, 5) + '*'.repeat(secret.length - 5),
      )
    }
    this.secret = secret
  }

  async verify(token: string) {
    try {
      verify(token, this.secret)
      return await this.isTokenInRedis(token)
    } catch (er) {
      console.debug(er, token)

      return false
    }
  }

  async isTokenInRedis(token: string) {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    const has = await redis.hexists(key, md5(token))
    return !!has
  }

  async getAllSignSession(currentToken?: string) {
    const redis = this.cacheService.getClient()
    const res = await redis.hgetall(getRedisKey(RedisKeys.JWTStore))
    const hashedCurrent = currentToken && md5(currentToken)
    return Object.entries(res).map(([k, v]) => {
      return {
        ...JSON.parse(v),
        id: `jwt-${k}`,
        current: hashedCurrent === k,
      }
    })
  }

  async revokeToken(token: string) {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    await redis.hdel(
      key,
      token.startsWith(`jwt-`) ? token.replace(`jwt-`, '') : md5(token),
    )
  }

  async revokeAll() {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    await redis.del(key)
  }

  async storeTokenInRedis(token: string, info?: any) {
    const redis = this.cacheService.getClient()
    await redis.hset(
      getRedisKey(RedisKeys.JWTStore),
      md5(token),
      JSON.stringify({
        date: new Date().toISOString(),
        ...info,
      } as StoreJWTPayload),
    )
  }

  private readonly expiresDay = SECURITY.jwtExpire

  sign(id: string, info?: { ip: string; ua: string }) {
    const token = sign({ id }, this.secret, {
      expiresIn: `${this.expiresDay}d`,
    })
    this.storeTokenInRedis(token, info || {})
    return token
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM)
  async scanTable() {
    this.logger.log('--> 开始扫表，清除过期的 token')
    const redis = this.cacheService.getClient()
    const keys = await redis.hkeys(getRedisKey(RedisKeys.JWTStore))
    let deleteCount = 0
    await Promise.all(
      keys.map(async (key) => {
        const value = await redis.hget(getRedisKey(RedisKeys.JWTStore), key)
        if (!value) {
          return null
        }
        const parsed = JSON.safeParse(value) as StoreJWTPayload
        if (!parsed) {
          return null
        }

        const date = dayjs(new Date(parsed.date))
        if (date.add(this.expiresDay, 'd').diff(new Date(), 'd') < 0) {
          this.logger.debug(
            `--> 删除过期的 token：${key}, 签发于 ${date.format(
              'YYYY-MM-DD H:mm:ss',
            )}`,
          )

          return await redis
            .hdel(getRedisKey(RedisKeys.JWTStore), key)
            .then(() => {
              deleteCount += 1
            })
        }
        return null
      }),
    )

    this.logger.log(`--> 删除了 ${deleteCount} 个过期的 token`)
  }
}

interface StoreJWTPayload {
  /**
   * ISODateString
   */
  date: string
  [k: string]: any
}

import cluster from 'node:cluster'
import { sign, verify } from 'jsonwebtoken'

import { Injectable } from '@nestjs/common'

import { CLUSTER, ENCRYPT, SECURITY } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { logger } from '~/global/consola.global'
import { getRedisKey } from '~/utils/redis.util'
import { md5 } from '~/utils/tool.util'

import { CacheService } from '../redis/cache.service'
import { RedisService } from '../redis/redis.service'

@Injectable()
export class JWTService {
  private secret = ''

  constructor(private readonly redisService: RedisService) {
    this.init()
  }

  init() {
    if (this.secret) {
      return
    }

    const ENCRYPT_KEY = ENCRYPT.key

    const secret =
      SECURITY.jwtSecret ||
      Buffer.from(ENCRYPT_KEY).toString('base64').slice(0, 15) ||
      'asjhczxiucipoiopiqm2376'

    if (isDev && cluster.isPrimary) {
      logger.debug(secret)
    }
    if (!CLUSTER.enable || cluster.isPrimary) {
      logger.debug(
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
    } catch (error) {
      console.debug('verify JWT error:', error.message, token)

      return false
    }
  }

  async isTokenInRedis(token: string) {
    const redis = this.redisService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    const has = await redis.hexists(key, md5(token))
    return !!has
  }

  async getAllSignSession(currentToken?: string) {
    const redis = this.redisService.getClient()
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

  async revokeToken(token: string, delay?: number) {
    const redis = this.redisService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    if (delay) {
      // FIXME
      setTimeout(() => {
        redis.hdel(
          key,
          token.startsWith(`jwt-`) ? token.replace(`jwt-`, '') : md5(token),
        )
      }, delay)
    } else {
      await redis.hdel(
        key,
        token.startsWith(`jwt-`) ? token.replace(`jwt-`, '') : md5(token),
      )
    }
  }

  async revokeAll(excludeTokens?: string[]) {
    if (Array.isArray(excludeTokens) && excludeTokens.length > 0) {
      const redis = this.redisService.getClient()
      const key = getRedisKey(RedisKeys.JWTStore)
      const allMd5Tokens = await redis.hkeys(key)

      const excludedMd5Tokens = excludeTokens.map((t) => md5(t))
      for (const md5Token of allMd5Tokens) {
        if (!excludedMd5Tokens.includes(md5Token)) {
          await redis.hdel(key, md5Token)
        }
      }
    } else {
      const redis = this.redisService.getClient()
      const key = getRedisKey(RedisKeys.JWTStore)
      await redis.del(key)
    }
  }

  async storeTokenInRedis(token: string, info?: any) {
    const redis = this.redisService.getClient()
    await redis.hset(
      getRedisKey(RedisKeys.JWTStore),
      md5(token),
      JSON.stringify({
        date: new Date().toISOString(),
        ...info,
      } as StoreJWTPayload),
    )
  }

  public static readonly expiresDay = SECURITY.jwtExpire

  async sign(id: string, info?: { ip: string; ua: string }) {
    const token = sign({ id }, this.secret, {
      expiresIn: `${JWTService.expiresDay}d`,
    })
    await this.storeTokenInRedis(token, info || {})
    return token
  }
}

export interface StoreJWTPayload {
  /**
   * ISODateString
   */
  date: string
  [k: string]: any
}

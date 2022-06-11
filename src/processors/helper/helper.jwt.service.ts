import cluster from 'cluster'
import { sign, verify } from 'jsonwebtoken'
import { machineIdSync } from 'node-machine-id'

import { Injectable } from '@nestjs/common'

import { CLUSTER, SECURITY } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { isTest } from '~/global/env.global'
import { getRedisKey, md5 } from '~/utils'

import { CacheService } from '../cache/cache.service'

@Injectable()
export class JWTService {
  private secret = ''
  constructor(private readonly cacheService: CacheService) {
    this.init()
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
      return isDev && !isTest ? true : await this.isTokenInRedis(token)
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

  async revokeToken(token: string) {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    await redis.hdel(key, md5(token))
  }

  async revokeAll() {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    await redis.del(key)
  }

  async storeTokenInRedis(token: string) {
    const redis = this.cacheService.getClient()
    await redis.hset(
      getRedisKey(RedisKeys.JWTStore),
      md5(token),
      JSON.stringify({
        date: new Date().toISOString(),
      }),
    )
  }

  sign(id: string) {
    const token = sign({ id }, this.secret)
    this.storeTokenInRedis(token)
    return token
  }
}

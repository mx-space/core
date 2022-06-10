import cluster from 'cluster'
import { SignOptions, sign, verify } from 'jsonwebtoken'
import { machineIdSync } from 'node-machine-id'

import { Injectable } from '@nestjs/common'

import { CLUSTER, SECURITY } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey, md5 } from '~/utils'

import { CacheService } from '../cache/cache.service'

@Injectable()
export class JWTService {
  private secret: string
  constructor(private readonly cacheService: CacheService) {
    this.init()
  }

  private init() {
    const getMachineId = () => {
      const id = machineIdSync()

      if (isDev && cluster.isPrimary) {
        console.log(id)
      }
      return id
    }
    this.secret =
      SECURITY.jwtSecret ||
      Buffer.from(getMachineId()).toString('base64').slice(0, 15) ||
      'asjhczxiucipoiopiqm2376'

    if (isDev && cluster.isPrimary) {
      console.log(this.secret)
    }
    if (!CLUSTER.enable || cluster.isPrimary) {
      console.log(
        'JWT Secret start with :',
        this.secret.slice(0, 5) + '*'.repeat(this.secret.length - 5),
      )
    }
  }
  async verify(token: string) {
    try {
      verify(token, this.secret)
      return await this.isTokenInRedis(token)
    } catch {
      return false
    }
  }

  async isTokenInRedis(id: string) {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    const token = await redis.sismember(key, md5(id))
    return !!token
  }

  async storeTokenInRedis(token: string) {
    const redis = this.cacheService.getClient()
    await redis.sadd(getRedisKey(RedisKeys.JWTStore), md5(token))
  }

  sign(id: string, options: SignOptions = { expiresIn: '7d' }): string {
    const token = sign({ id }, this.secret, options)
    this.storeTokenInRedis(token)
    return token
  }
}

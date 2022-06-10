import cluster from 'cluster'
import { SignOptions, sign, verify } from 'jsonwebtoken'
import { machineIdSync } from 'node-machine-id'

import { Injectable } from '@nestjs/common'

import { CLUSTER, SECURITY } from '~/app.config'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey, md5 } from '~/utils'

import { CacheService } from '../cache/cache.service'

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

@Injectable()
export class JWTService {
  constructor(private readonly cacheService: CacheService) {}

  async verify(token: string) {
    try {
      verify(token, secret)
      return await this.isTokenInRedis(token)
    } catch (er) {
      console.debug(er, token)

      return false
    }
  }

  async isTokenInRedis(token: string) {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    const has = await redis.sismember(key, md5(token))
    return !!has
  }

  async invokeToken(token: string) {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    await redis.srem(key, md5(token))
  }

  async invokeAll() {
    const redis = this.cacheService.getClient()
    const key = getRedisKey(RedisKeys.JWTStore)
    await redis.del(key)
  }

  async storeTokenInRedis(token: string) {
    const redis = this.cacheService.getClient()
    await redis.sadd(getRedisKey(RedisKeys.JWTStore), md5(token))
  }

  sign(id: string, options: SignOptions = { expiresIn: '7d' }) {
    const token = sign({ id }, secret, options)
    this.storeTokenInRedis(token)
    return token
  }
}

import { Injectable } from '@nestjs/common'
import { Emitter } from '@socket.io/redis-emitter'
import { REDIS } from '~/app.config'
import { RedisIoAdapterKey } from '~/common/adapters/socket.adapter'
import { API_CACHE_PREFIX } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'
import IORedis from 'ioredis'

@Injectable()
export class RedisService {
  private redisClient: IORedis
  constructor() {
    this.redisClient = new IORedis({
      host: REDIS.host,
      port: REDIS.port,
      password: REDIS.password,
    })
  }

  private _emitter: Emitter

  public getClient() {
    return this.redisClient
  }

  public get emitter(): Emitter {
    if (this._emitter) {
      return this._emitter
    }
    this._emitter = new Emitter(this.redisClient, {
      key: RedisIoAdapterKey,
    })

    return this._emitter
  }

  public async cleanCatch() {
    const redis = this.getClient()
    const keys: string[] = await redis.keys(`${API_CACHE_PREFIX}*`)
    await Promise.all(keys.map((key) => redis.del(key)))

    return
  }

  public async cleanKey(key: string) {
    const redis = this.getClient()
    await redis.del(key)

    return
  }

  public async cleanAllRedisKey() {
    const redis = this.getClient()
    const keys: string[] = await redis.keys(getRedisKey('*'))

    await Promise.all(keys.map((key) => redis.del(key)))

    return
  }
}

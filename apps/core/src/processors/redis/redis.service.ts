import { Injectable, Logger } from '@nestjs/common'
import { Emitter } from '@socket.io/redis-emitter'
import type { RedisOptions } from 'ioredis'
import IORedis from 'ioredis'

import { REDIS } from '~/app.config'
import { RedisIoAdapterKey } from '~/common/adapters/socket.adapter'
import { API_CACHE_PREFIX } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

export const REDIS_CLIENT_OPTIONS: RedisOptions = {
  commandTimeout: 5000,
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  retryStrategy(times: number) {
    return Math.min(times * 200, 5000)
  },
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name)
  private redisClient: IORedis
  constructor() {
    const sharedOptions: RedisOptions = {
      username: (REDIS as any).username,
      password: REDIS.password ?? undefined,
      db: (REDIS as any).db,
      ...(REDIS.tls ? { tls: {} } : {}),
      ...REDIS_CLIENT_OPTIONS,
    }

    this.redisClient = REDIS.url
      ? new IORedis(REDIS.url, sharedOptions)
      : new IORedis({ host: REDIS.host, port: REDIS.port, ...sharedOptions })

    this.redisClient.on('error', (err) => {
      this.logger.error(
        this.formatStateLog('Redis connection error', {
          error: err.message,
        }),
      )
    })
    this.redisClient.on('ready', () => {
      this.logger.log(this.formatStateLog('Redis connection ready'))
    })
    this.redisClient.on('reconnecting', () => {
      this.logger.warn(this.formatStateLog('Redis reconnecting'))
    })
    this.redisClient.on('close', () => {
      this.logger.warn(this.formatStateLog('Redis connection closed'))
    })
  }

  private _emitter: Emitter

  public getClient() {
    return this.redisClient
  }

  public isReady() {
    return this.redisClient.status === 'ready'
  }

  public isClientReady(client: IORedis | undefined) {
    return client?.status === 'ready'
  }

  public getStatus() {
    return this.redisClient.status
  }

  public duplicateClient() {
    return this.redisClient.duplicate()
  }

  public waitForReady(client: IORedis = this.redisClient, timeoutMs = 15000) {
    if (this.isClientReady(client)) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup()
        resolve()
      }
      const onTimeout = () => {
        cleanup()
        reject(
          new Error(
            `Redis client did not become ready within ${timeoutMs}ms (status: ${client.status})`,
          ),
        )
      }
      const cleanup = () => {
        clearTimeout(timer)
        client.off('ready', onReady)
      }

      const timer = setTimeout(onTimeout, timeoutMs)
      client.once('ready', onReady)
    })
  }

  public isUnavailableError(error: unknown) {
    return (
      error instanceof Error &&
      error.message.includes(
        "Stream isn't writeable and enableOfflineQueue options is false",
      )
    )
  }

  public formatStateLog(
    message: string,
    extra?: Record<string, string | number | boolean | null | undefined>,
  ) {
    return JSON.stringify({
      module: RedisService.name,
      message,
      redisStatus: this.getStatus(),
      ...extra,
    })
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

  /**
   * Iterate the keyspace with a non-blocking cursor (`SCAN`) instead of the
   * O(N) blocking `KEYS`. Collects every key matching `pattern`. Use this on
   * hot/scheduled/public paths where `KEYS` would stall the whole Redis.
   */
  public async scanKeys(
    pattern: string,
    count = 100,
    client: IORedis = this.redisClient,
  ): Promise<string[]> {
    const keys: string[] = []
    const stream = client.scanStream({ match: pattern, count })
    for await (const batch of stream) {
      if ((batch as string[]).length > 0) keys.push(...(batch as string[]))
    }
    return keys
  }

  /**
   * Delete every key matching `pattern` using a cursor scan, deleting in
   * batches with `UNLINK` (non-blocking reclaim) to avoid stalling Redis on
   * large key sets.
   */
  public async deleteKeysByPattern(
    pattern: string,
    options: { count?: number; batchSize?: number } = {},
  ): Promise<number> {
    const { count = 100, batchSize = 500 } = options
    const redis = this.getClient()
    let deleted = 0
    let buffer: string[] = []

    const flush = async () => {
      if (buffer.length === 0) return
      deleted += await redis.unlink(...buffer)
      buffer = []
    }

    const stream = redis.scanStream({ match: pattern, count })
    for await (const batch of stream) {
      const keys = batch as string[]
      if (keys.length === 0) continue
      buffer.push(...keys)
      if (buffer.length >= batchSize) await flush()
    }
    await flush()

    return deleted
  }

  public async cleanCatch() {
    await this.deleteKeysByPattern(`${API_CACHE_PREFIX}*`)

    return
  }

  public async cleanKey(key: string) {
    const redis = this.getClient()
    await redis.del(key)

    return
  }

  public async cleanAllRedisKey() {
    await this.deleteKeysByPattern(getRedisKey('*'))

    return
  }
}

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import type { SocketMetadata } from '~/types/socket-meta'
import { getRedisKey } from '~/utils/redis.util'
import { safeJSONParse } from '~/utils/tool.util'

import { RedisService } from '../redis/redis.service'

export type SocketLike = { id: string }

@Injectable()
export class GatewayService implements OnModuleInit {
  private static readonly REDIS_WARN_INTERVAL_MS = 30_000
  private readonly logger = new Logger(GatewayService.name)
  private socketStoreInitialized = false
  private socketStoreInitPromise: Promise<boolean> | null = null
  private lastRedisUnavailableWarnAt = 0

  constructor(private readonly redisService: RedisService) {}

  onModuleInit() {
    void this.ensureSocketStoreReady()
  }

  async setSocketMetadata(socket: SocketLike, value: object) {
    if (!(await this.ensureSocketStoreReady())) {
      return
    }

    const existValue = await this.getSocketMetadata(socket)

    const client = this.redisService.getClient()
    const data = {
      ...existValue,
      ...value,
    }

    try {
      await client.hset(
        getRedisKey(RedisKeys.Socket),
        socket.id,
        JSON.stringify(data),
      )
    } catch (error) {
      this.handleRedisError(error, 'Failed to persist socket metadata')
    }
  }

  async getSocketMetadata(socket: SocketLike): Promise<SocketMetadata> {
    if (!(await this.ensureSocketStoreReady())) {
      return this.getDefaultSocketMetadata()
    }

    const client = this.redisService.getClient()
    try {
      const data = await client.hget(getRedisKey(RedisKeys.Socket), socket.id)
      return {
        ...this.getDefaultSocketMetadata(),
        ...safeJSONParse(data),
      }
    } catch (error) {
      this.handleRedisError(error, 'Failed to read socket metadata')
      return this.getDefaultSocketMetadata()
    }
  }

  async getSocketMetadataMany(ids: string[]): Promise<SocketMetadata[]> {
    if (ids.length === 0) return []
    if (!(await this.ensureSocketStoreReady())) {
      return ids.map(() => this.getDefaultSocketMetadata())
    }

    const client = this.redisService.getClient()
    try {
      const rows = await client.hmget(getRedisKey(RedisKeys.Socket), ...ids)
      return rows.map((row) => ({
        ...this.getDefaultSocketMetadata(),
        ...safeJSONParse(row),
      }))
    } catch (error) {
      this.handleRedisError(error, 'Failed to read socket metadata')
      return ids.map(() => this.getDefaultSocketMetadata())
    }
  }

  async clearSocketMetadata(socket: SocketLike) {
    if (!(await this.ensureSocketStoreReady())) {
      return
    }

    const client = this.redisService.getClient()
    try {
      await client.hdel(getRedisKey(RedisKeys.Socket), socket.id)
    } catch (error) {
      this.handleRedisError(error, 'Failed to clear socket metadata')
    }
  }

  private async ensureSocketStoreReady(): Promise<boolean> {
    if (this.socketStoreInitialized) {
      return true
    }

    if (this.socketStoreInitPromise) {
      return this.socketStoreInitPromise
    }

    this.socketStoreInitPromise = this.initializeSocketStore()
    try {
      return await this.socketStoreInitPromise
    } finally {
      this.socketStoreInitPromise = null
    }
  }

  private async initializeSocketStore(): Promise<boolean> {
    if (!this.redisService.isReady()) {
      this.warnRedisUnavailable('Gateway socket metadata is waiting for Redis')
      return false
    }

    this.socketStoreInitialized = true
    return true
  }

  private handleRedisError(error: unknown, message: string) {
    if (this.redisService.isUnavailableError(error)) {
      this.warnRedisUnavailable('Gateway socket metadata is waiting for Redis')
      return
    }

    if (error instanceof Error) {
      this.logger.error(`${message}: ${error.message}`, error.stack)
      return
    }

    this.logger.error(message)
  }

  private getDefaultSocketMetadata(): SocketMetadata {
    return {
      sessionId: '',
      roomJoinedAtMap: {},
    }
  }

  private warnRedisUnavailable(message: string) {
    const now = Date.now()
    if (
      now - this.lastRedisUnavailableWarnAt <
      GatewayService.REDIS_WARN_INTERVAL_MS
    ) {
      return
    }

    this.lastRedisUnavailableWarnAt = now
    this.logger.warn(
      JSON.stringify({
        module: GatewayService.name,
        message,
        redisStatus: this.redisService.getStatus(),
      }),
    )
  }
}

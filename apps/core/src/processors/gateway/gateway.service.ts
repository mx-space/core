import type { SocketMetadata } from '~/types/socket-meta'
import type { RemoteSocket, Socket } from 'socket.io'
import type {
  DecorateAcknowledgementsWithMultipleResponses,
  DefaultEventsMap,
} from 'socket.io/dist/typed-events'

import { Injectable } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'
import { safeJSONParse } from '~/utils/tool.util'

import { CacheService } from '../redis/cache.service'
import { RedisService } from '../redis/redis.service'

export type SocketType =
  | Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
  | RemoteSocket<
      DecorateAcknowledgementsWithMultipleResponses<DefaultEventsMap>,
      any
    >

@Injectable()
export class GatewayService {
  constructor(private readonly redisService: RedisService) {
    redisService.getClient().del(getRedisKey(RedisKeys.Socket))
  }

  async setSocketMetadata(socket: SocketType, value: object) {
    const existValue = await this.getSocketMetadata(socket)

    const client = this.redisService.getClient()
    const data = {
      ...existValue,
      ...value,
    }
    // socket.data = data
    await client.hset(
      getRedisKey(RedisKeys.Socket),
      socket.id,
      JSON.stringify(data),
    )
  }

  async getSocketMetadata(socket: SocketType): Promise<SocketMetadata> {
    const client = this.redisService.getClient()
    const data = await client.hget(getRedisKey(RedisKeys.Socket), socket.id)
    return safeJSONParse(data) || {}
  }

  async clearSocketMetadata(socket: SocketType) {
    const client = this.redisService.getClient()
    await client.hdel(getRedisKey(RedisKeys.Socket), socket.id)
  }
}

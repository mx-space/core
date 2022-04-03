/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { plainToClass } from 'class-transformer'
import { validate } from 'class-validator'
import SocketIO from 'socket.io'

import {
  ConnectedSocket,
  GatewayMetadata,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Emitter } from '@socket.io/redis-emitter'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getRedisKey } from '~/utils/redis.util'
import { getShortDate } from '~/utils/time.util'

import { BoardcastBaseGateway } from '../base.gateway'
import { DanmakuDto } from './dtos/danmaku.dto'

@WebSocketGateway<GatewayMetadata>({
  namespace: 'web',
})
export class WebEventsGateway
  extends BoardcastBaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly cacheService: CacheService) {
    super()
  }

  @WebSocketServer()
  private namespace: SocketIO.Namespace

  async sendOnlineNumber() {
    return {
      online: await this.getcurrentClientCount(),
      timestamp: new Date().toISOString(),
    }
  }
  @SubscribeMessage(BusinessEvents.DANMAKU_CREATE)
  createNewDanmaku(
    @MessageBody() data: DanmakuDto,
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const validator = plainToClass(DanmakuDto, data)
    validate(validator).then((errors) => {
      if (errors.length > 0) {
        return client.send(errors)
      }
      this.broadcast(BusinessEvents.DANMAKU_CREATE, data)
      client.send([])
    })
  }

  async getcurrentClientCount() {
    const server = this.namespace.server
    const sockets = await server.of('/web').adapter.sockets(new Set())
    return sockets.size
  }
  async handleConnection(socket: SocketIO.Socket) {
    this.broadcast(BusinessEvents.VISITOR_ONLINE, await this.sendOnlineNumber())

    process.nextTick(async () => {
      const redisClient = this.cacheService.getClient()
      const dateFormat = getShortDate(new Date())

      // get and store max_online_count
      const maxOnlineCount =
        +(await redisClient.hget(
          getRedisKey(RedisKeys.MaxOnlineCount),
          dateFormat,
        ))! || 0
      await redisClient.hset(
        getRedisKey(RedisKeys.MaxOnlineCount),
        dateFormat,
        Math.max(maxOnlineCount, await this.getcurrentClientCount()),
      )
      const key = getRedisKey(RedisKeys.MaxOnlineCount, 'total')

      const totalCount = +(await redisClient.hget(key, dateFormat))! || 0
      await redisClient.hset(key, dateFormat, totalCount + 1)
    })

    super.handleConnect(socket)
  }
  async handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.broadcast(
      BusinessEvents.VISITOR_OFFLINE,
      await this.sendOnlineNumber(),
    )
  }

  override broadcast(event: BusinessEvents, data: any) {
    const client = new Emitter(this.cacheService.getClient())
    client.of('/web').emit('message', this.gatewayMessageFormat(event, data))
  }
}

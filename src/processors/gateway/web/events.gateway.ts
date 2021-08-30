/*
 * @Author: Innei
 * @Date: 2020-05-21 18:59:01
 * @LastEditTime: 2021-02-24 21:22:29
 * @LastEditors: Innei
 * @FilePath: /server/apps/server/src/gateway/web/events.gateway.ts
 * @Copyright
 */
import {
  ConnectedSocket,
  GatewayMetadata,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { plainToClass } from 'class-transformer'
import { validate } from 'class-validator'
import { BaseGateway } from '../base.gateway'
import { EventTypes } from '../events.types'
import { DanmakuDto } from './dtos/danmaku.dto'
import SocketIO from 'socket.io'
import dayjs from 'dayjs'
import { CacheService } from '~/processors/cache/cache.service'

@WebSocketGateway<GatewayMetadata>({
  namespace: 'web',
})
export class WebEventsGateway
  extends BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly cacheService: CacheService) {
    super()
  }

  async sendOnlineNumber() {
    return {
      online: this.wsClients.length,
      timestamp: new Date().toISOString(),
    }
  }
  @SubscribeMessage(EventTypes.DANMAKU_CREATE)
  createNewDanmaku(
    @MessageBody() data: DanmakuDto,
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const validator = plainToClass(DanmakuDto, data)
    validate(validator).then((errors) => {
      if (errors.length > 0) {
        return client.send(errors)
      }
      this.broadcast(EventTypes.DANMAKU_CREATE, data)
      client.send([])
    })
  }

  async handleConnection(client: SocketIO.Socket) {
    this.wsClients.push(client)
    this.broadcast(EventTypes.VISITOR_ONLINE, await this.sendOnlineNumber())

    process.nextTick(async () => {
      // TODO: 这里需要实现一个统计总数, 每天在线人数
      const redisClient = this.cacheService.getClient()
      const dateFormat = dayjs().format('YYYY-MM-DD')
    })

    super.handleConnect(client)
  }
  async handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.broadcast(EventTypes.VISITOR_OFFLINE, await this.sendOnlineNumber())
  }
}

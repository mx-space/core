/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { uniqBy } from 'lodash'
import SocketIO from 'socket.io'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { BroadcastOperator, Emitter } from '@socket.io/redis-emitter'
import type { DefaultEventsMap } from 'socket.io/dist/typed-events'
import type { EventGatewayHooks, HookFunction } from './hook.interface'

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/redis/cache.service'
import { scheduleManager } from '~/utils'
import { getRedisKey } from '~/utils/redis.util'
import { getSocketMetadata, setSocketMetadata } from '~/utils/socket.util'
import { getShortDate } from '~/utils/time.util'

import { BroadcastBaseGateway } from '../base.gateway'
import { MessageEventDto, SupportedMessageEvent } from './dtos/message'

declare module '~/utils/socket.util' {
  interface SocketMetadata {
    sessionId: string
  }
}

const namespace = 'web'
@WebSocketGateway<GatewayMetadata>({
  namespace,
})
export class WebEventsGateway
  extends BroadcastBaseGateway
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

  async getcurrentClientCount() {
    const server = this.namespace.server

    const sockets: SocketIO.Socket[] = await server
      .of(`/${namespace}`)
      .adapter.fetchSockets({
        rooms: new Set(),
      })
    // 这里用 web socket id 作为同一用户，一般 web 用 userId 或者 local storage sessionId 作为 socket session id
    return uniqBy(sockets, (x) => {
      return getSocketMetadata(x)?.sessionId || true
    }).length
  }

  @SubscribeMessage('message')
  handleMessageEvent(
    @MessageBody() data: MessageEventDto,
    @ConnectedSocket() socket: SocketIO.Socket,
  ) {
    const { payload, type } = data

    // logger.debug('Received message', { type, payload })

    switch (type) {
      case SupportedMessageEvent.Join: {
        const { roomName } = payload as { roomName: string }
        if (roomName) socket.join(roomName)
        break
      }
      case SupportedMessageEvent.Leave: {
        const { roomName } = payload as { roomName: string }
        if (roomName) socket.leave(roomName)
        break
      }
      case SupportedMessageEvent.UpdateSid: {
        const { sessionId } = payload as { sessionId: string }
        if (sessionId) {
          setSocketMetadata(socket, { sessionId })
          this.whenUserOnline()
        }
      }
    }

    this.hooks.onMessage.forEach((fn) => fn(socket, data))
  }

  async handleConnection(socket: SocketIO.Socket) {
    const webSessionId =
      socket.handshake.headers['x-socket-session-id'] ||
      socket.handshake.query['socket_session_id'] ||
      // fallback sid
      socket.id

    // logger.debug('webSessionId', webSessionId)

    setSocketMetadata(socket, { sessionId: webSessionId })

    this.whenUserOnline()
    super.handleConnect(socket)
    this.hooks.onConnected.forEach((fn) => fn(socket))
  }

  async whenUserOnline() {
    this.broadcast(BusinessEvents.VISITOR_ONLINE, await this.sendOnlineNumber())

    scheduleManager.schedule(async () => {
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
  }

  private hooks: EventGatewayHooks = {
    onConnected: [],
    onDisconnected: [],
    onMessage: [],
  }

  public registerHook(type: keyof EventGatewayHooks, callback: HookFunction) {
    this.hooks[type].push(callback)
    return () => {
      // @ts-expect-error
      this.hooks[type] = this.hooks[type].filter((fn) => fn !== callback)
    }
  }

  async handleDisconnect(socket: SocketIO.Socket) {
    super.handleDisconnect(socket)
    this.broadcast(BusinessEvents.VISITOR_OFFLINE, {
      ...(await this.sendOnlineNumber()),
      sessionId: getSocketMetadata(socket)?.sessionId,
    })
    this.hooks.onDisconnected.forEach((fn) => fn(socket))
  }

  override broadcast(
    event: BusinessEvents,
    data: any,

    options?: {
      rooms?: string[]
      local?: boolean
    },
  ) {
    const emitter = this.cacheService.emitter

    let socket = emitter.of(`/${namespace}`) as
      | Emitter<DefaultEventsMap>
      | BroadcastOperator<DefaultEventsMap>
    const rooms = options?.rooms

    if (rooms && rooms.length > 0) {
      socket = socket.in(rooms)
    }
    socket.emit('message', this.gatewayMessageFormat(event, data))
  }

  public async getSocketsOfRoom(roomName: string): Promise<SocketIO.Socket[]> {
    const roomNameSet = this.namespace.adapter.rooms.get(roomName)
    if (roomNameSet)
      return this.namespace.adapter.fetchSockets({
        rooms: roomNameSet,
      })
    return []
  }
}

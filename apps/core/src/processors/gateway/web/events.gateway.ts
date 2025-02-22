import { debounce, uniqBy } from 'lodash'
import SocketIO from 'socket.io'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { BroadcastOperator, Emitter } from '@socket.io/redis-emitter'
import type {
  DecorateAcknowledgementsWithMultipleResponses,
  DefaultEventsMap,
} from 'socket.io/dist/typed-events'
import type { SocketType } from '../gateway.service'
import type { EventGatewayHooks } from './hook.interface'

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
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getShortDate } from '~/utils/time.util'

import { BroadcastBaseGateway } from '../base.gateway'
import { GatewayService } from '../gateway.service'
import { MessageEventDto, SupportedMessageEvent } from './dtos/message'

declare module '~/types/socket-meta' {
  interface SocketMetadata {
    sessionId: string

    roomJoinedAtMap: Record<string, number>
  }
}

const namespace = 'web'

// @UseGuards(WsExtendThrottlerGuard)
@WebSocketGateway<GatewayMetadata>({
  namespace,
})
export class WebEventsGateway
  extends BroadcastBaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly redisService: RedisService,

    private readonly gatewayService: GatewayService,
  ) {
    super()
  }

  private hooks: EventGatewayHooks = {
    onConnected: [],
    onDisconnected: [],
    onMessage: [],

    onJoinRoom: [],
    onLeaveRoom: [],
  }

  public registerHook<T extends keyof EventGatewayHooks>(
    type: T,
    callback: EventGatewayHooks[T][number],
  ) {
    // @ts-expect-error
    this.hooks[type].push(callback)
    return () => {
      // @ts-expect-error
      this.hooks[type] = this.hooks[type].filter((fn) => fn !== callback)
    }
  }

  @WebSocketServer()
  private namespace: SocketIO.Namespace

  async sendOnlineNumber() {
    return {
      online: await this.getCurrentClientCount(),
      timestamp: new Date().toISOString(),
    }
  }

  async getCurrentClientCount() {
    const server = this.namespace.server

    const socketsMeta = await Promise.all(
      await server
        .of(`/${namespace}`)
        .fetchSockets()
        .then((sockets) => {
          return sockets.map((socket) =>
            this.gatewayService.getSocketMetadata(socket),
          )
        }),
    )
    // // 这里用 web socket id 作为同一用户，一般 web 用 userId 或者 local storage sessionId 作为 socket session id
    // return uniqBy(socketsMeta, async (x) => {
    //   const meta = await this.gatewayService.getSocketMetadata(x)
    //   console.log(meta, 'meta', x.id, 'x.id')
    //   return meta?.sessionId || true
    // }).length
    return uniqBy(socketsMeta, (x) => x?.sessionId).length
  }

  @SubscribeMessage('message')
  async handleMessageEvent(
    @MessageBody() data: MessageEventDto,
    @ConnectedSocket() socket: SocketIO.Socket,
  ) {
    const { payload, type } = data

    // logger.debug('Received message', { type, payload })

    switch (type) {
      case SupportedMessageEvent.Join: {
        const { roomName } = payload as { roomName: string }
        if (roomName) {
          socket.join(roomName)
          this.hooks.onJoinRoom.forEach((fn) => fn(socket, roomName))

          const roomJoinedAtMap = await this.getSocketRoomJoinedAtMap(socket)

          roomJoinedAtMap[roomName] = Date.now()

          await this.gatewayService.setSocketMetadata(socket, {
            roomJoinedAtMap,
          })
        }
        break
      }
      case SupportedMessageEvent.Leave: {
        const { roomName } = payload as { roomName: string }
        if (roomName) {
          socket.leave(roomName)
          this.hooks.onLeaveRoom.forEach((fn) => fn(socket, roomName))

          const roomJoinedAtMap = await this.getSocketRoomJoinedAtMap(socket)
          delete roomJoinedAtMap[roomName]
          await this.gatewayService.setSocketMetadata(socket, {
            roomJoinedAtMap,
          })
        }
        break
      }
      case SupportedMessageEvent.UpdateSid: {
        const { sessionId } = payload as { sessionId: string }
        if (sessionId) {
          await this.gatewayService.setSocketMetadata(socket, { sessionId })
          this.whenUserOnline()
        }
      }
    }

    this.hooks.onMessage.forEach((fn) => fn(socket, data))
  }

  async handleConnection(socket: SocketIO.Socket) {
    const webSessionId =
      socket.handshake.headers['x-socket-session-id'] ||
      socket.handshake.query.socket_session_id ||
      // fallback sid
      socket.id

    // logger.debug('webSessionId', webSessionId)

    await this.gatewayService.setSocketMetadata(socket, {
      sessionId: webSessionId,
    })

    this.whenUserOnline()
    super.handleConnect(socket)
    this.hooks.onConnected.forEach((fn) => fn(socket))
  }

  whenUserOnline = debounce(
    async () => {
      this.broadcast(
        BusinessEvents.VISITOR_ONLINE,
        await this.sendOnlineNumber(),
      )

      scheduleManager.schedule(async () => {
        const redisClient = this.redisService.getClient()
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
          Math.max(maxOnlineCount, await this.getCurrentClientCount()),
        )
        const key = getRedisKey(RedisKeys.MaxOnlineCount, 'total')

        const totalCount = +(await redisClient.hget(key, dateFormat))! || 0
        await redisClient.hset(key, dateFormat, totalCount + 1)
      })
    },
    1000,
    {
      leading: false,
    },
  )

  async handleDisconnect(socket: SocketIO.Socket) {
    super.handleDisconnect(socket)
    this.broadcast(BusinessEvents.VISITOR_OFFLINE, {
      ...(await this.sendOnlineNumber()),
      sessionId: (await this.gatewayService.getSocketMetadata(socket))
        ?.sessionId,
    })
    this.hooks.onDisconnected.forEach((fn) => fn(socket))
    this.gatewayService.clearSocketMetadata(socket)

    socket.rooms.forEach((roomName) => {
      this.hooks.onLeaveRoom.forEach((fn) => fn(socket, roomName))
    })
  }

  override broadcast(
    event: BusinessEvents,
    data: any,

    options?: {
      rooms?: string[]
      exclude?: string[]
    },
  ) {
    const emitter = this.redisService.emitter

    let socket = emitter.of(`/${namespace}`) as
      | Emitter<DefaultEventsMap>
      | BroadcastOperator<DefaultEventsMap>
    const rooms = options?.rooms
    const exclude = options?.exclude

    if (rooms && rooms.length > 0) {
      socket = socket.in(rooms)
    }
    if (exclude && exclude.length > 0) {
      socket = socket.except(exclude)
    }
    socket.emit('message', this.gatewayMessageFormat(event, data))
  }

  public getSocketsOfRoom(
    roomName: string,
  ): Promise<
    | SocketIO.Socket[]
    | SocketIO.RemoteSocket<
        DecorateAcknowledgementsWithMultipleResponses<DefaultEventsMap>,
        any
      >[]
  > {
    return this.namespace.in(roomName).fetchSockets()
  }

  // private isValidBizRoomName(roomName: string) {
  //   return roomName.split('-').length === 2
  // }
  public async getAllRooms() {
    const sockets = await this.namespace.fetchSockets()
    const roomToSocketsMap = {} as Record<string, (typeof sockets)[number][]>
    for (const socket of sockets) {
      socket.rooms.forEach((roomName) => {
        if (roomName === socket.id) return

        if (!roomToSocketsMap[roomName]) {
          roomToSocketsMap[roomName] = []
        }
        roomToSocketsMap[roomName].push(socket)
      })
    }
    return roomToSocketsMap
  }

  public async getSocketRoomJoinedAtMap(socket: SocketType) {
    const roomJoinedAtMap =
      (await this.gatewayService.getSocketMetadata(socket))?.roomJoinedAtMap ||
      {}

    return roomJoinedAtMap
  }
}

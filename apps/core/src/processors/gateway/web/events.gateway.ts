import { Logger } from '@nestjs/common'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { BroadcastOperator, Emitter } from '@socket.io/redis-emitter'
import { debounce, uniqBy } from 'es-toolkit/compat'
import type SocketIO from 'socket.io'
import { DefaultEventsMap } from 'socket.io'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getShortDate } from '~/utils/time.util'

import { BroadcastBaseGateway } from '../base.gateway'
import type { SocketType } from '../gateway.service'
import { GatewayService } from '../gateway.service'
import { MessageEventDto, SupportedMessageEvent } from './dtos/message.schema'
import type { EventGatewayHooks } from './hook.interface'

declare module '~/types/socket-meta' {
  interface SocketMetadata {
    sessionId: string
    lang?: string

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
  private readonly logger = new Logger(WebEventsGateway.name)
  private readonly socketFetchSoftTimeoutMs = 800
  private lastSocketFetchWarnAt = 0

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

    try {
      const socketsMeta = await Promise.all(
        await this.fetchSocketsWithSoftTimeout(
          () => server.of(`/${namespace}`).fetchSockets(),
          'getCurrentClientCount',
        ).then((sockets) => {
          return sockets.map((socket) =>
            this.gatewayService.getSocketMetadata(socket),
          )
        }),
      )
      return uniqBy(socketsMeta, (x) => x?.sessionId).length
    } catch (error) {
      this.warnSocketFetchFailure(
        'fetchSockets failed in getCurrentClientCount, fallback to local sockets count',
        error,
      )
      return this.namespace.sockets.size
    }
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
          this.logger.log(`Socket ${socket.id} joined room [${roomName}]`)
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
        break
      }
      case SupportedMessageEvent.UpdateLang: {
        const { lang } = payload as { lang: string }
        if (
          lang &&
          typeof lang === 'string' &&
          /^[a-z]{2}(?:-[A-Za-z]{2,})?$/.test(lang)
        ) {
          await this.updateSocketLang(socket, lang)
        }
        break
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

    const rawLang = socket.handshake.query.lang as string | undefined
    const lang =
      rawLang && /^[a-z]{2}(?:-[A-Za-z]{2,})?$/.test(rawLang)
        ? rawLang
        : undefined

    await this.gatewayService.setSocketMetadata(socket, {
      sessionId: webSessionId,
      ...(lang ? { lang } : {}),
    })

    if (lang) {
      socket.join(`lang:${lang}`)
    }

    this.whenUserOnline()
    super.handleConnect(socket)
    this.hooks.onConnected.forEach((fn) => fn(socket))

    // Send current online count directly to the connecting socket,
    // bypassing Redis emitter to ensure delivery
    this.sendOnlineNumber()
      .then((data) => {
        socket.emit(
          'message',
          this.gatewayMessageFormat(BusinessEvents.VISITOR_ONLINE, data),
        )
      })
      .catch(() => {})
  }

  private async updateSocketLang(socket: SocketIO.Socket, lang: string) {
    const meta = await this.gatewayService.getSocketMetadata(socket)
    const prevLang = meta?.lang
    if (prevLang) {
      socket.leave(`lang:${prevLang}`)
    }
    socket.join(`lang:${lang}`)
    await this.gatewayService.setSocketMetadata(socket, { lang })
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
      this.logger.log(`broadcast [${event}] to rooms [${rooms.join(',')}]`)
      socket = socket.in(rooms)
    } else {
      this.logger.log(`broadcast [${event}] to all`)
    }
    if (exclude && exclude.length > 0) {
      socket = socket.except(exclude)
    }
    socket.emit('message', this.gatewayMessageFormat(event, data))
  }

  public async getSocketsOfRoom(
    roomName: string,
  ): Promise<SocketIO.Socket[] | SocketIO.RemoteSocket<any, any>[]> {
    try {
      return await this.fetchSocketsWithSoftTimeout(
        () => this.namespace.in(roomName).fetchSockets(),
        `getSocketsOfRoom(${roomName})`,
      )
    } catch (error) {
      this.warnSocketFetchFailure(
        `fetchSockets failed for room [${roomName}], fallback to local room sockets`,
        error,
      )
      try {
        return await this.namespace.in(roomName).local.fetchSockets()
      } catch (fallbackError) {
        this.warnSocketFetchFailure(
          `local fetchSockets failed for room [${roomName}], returning empty`,
          fallbackError,
        )
        return []
      }
    }
  }

  // private isValidBizRoomName(roomName: string) {
  //   return roomName.split('-').length === 2
  // }
  public async getAllRooms() {
    let sockets: Awaited<ReturnType<typeof this.namespace.fetchSockets>>
    try {
      sockets = await this.fetchSocketsWithSoftTimeout(
        () => this.namespace.fetchSockets(),
        'getAllRooms',
      )
    } catch (error) {
      this.warnSocketFetchFailure(
        'fetchSockets failed in getAllRooms, fallback to local sockets',
        error,
      )
      try {
        sockets = await this.namespace.local.fetchSockets()
      } catch (fallbackError) {
        this.warnSocketFetchFailure(
          'local fetchSockets failed in getAllRooms, returning empty',
          fallbackError,
        )
        return {}
      }
    }
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

  private async fetchSocketsWithSoftTimeout<T>(
    fetcher: () => Promise<T>,
    context: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined

    try {
      return await Promise.race([
        fetcher(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `fetchSockets soft timeout (${this.socketFetchSoftTimeoutMs}ms) in ${context}`,
              ),
            )
          }, this.socketFetchSoftTimeoutMs)
        }),
      ])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  private warnSocketFetchFailure(message: string, error: unknown) {
    const now = Date.now()
    if (now - this.lastSocketFetchWarnAt < 10_000) {
      return
    }
    this.lastSocketFetchWarnAt = now

    const reason = error instanceof Error ? error.message : String(error)
    this.logger.warn(`${message}. reason=${reason}`)
  }
}

import type { IncomingMessage } from 'node:http'

import type { WsEnvelope } from '@mx-space/ws-client/protocol'
import { Logger } from '@nestjs/common'
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { debounce, uniqBy } from 'es-toolkit/compat'
import type { WebSocket } from 'ws'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getShortDate } from '~/utils/time.util'

import type { SocketLike } from '../gateway.service'
import { GatewayService } from '../gateway.service'
import type { WsConnection } from '../ws/ws.types'
import { WsBusService } from '../ws/ws-bus.service'
import { buildAck } from '../ws/ws-envelope'
import {
  LANG_PATTERN,
  langUpdatePayloadSchema,
  roomPayloadSchema,
  sessionUpdatePayloadSchema,
  WsInboundEvents,
} from '../ws/ws-events'
import { WsGatewayBase } from '../ws/ws-gateway.base'
import { WsPresenceService } from '../ws/ws-presence.service'
import type { EventGatewayHooks } from './hook.interface'

declare module '~/types/socket-meta' {
  interface SocketMetadata {
    sessionId: string
    lang?: string
    readerId?: string
    connectedAt?: number

    roomJoinedAtMap: Record<string, number>
  }
}

const langRoom = (lang: string) => `lang:${lang}`

@WebSocketGateway({ path: '/ws/web' })
export class WebEventsGateway
  extends WsGatewayBase
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebEventsGateway.name)

  constructor(
    private readonly redisService: RedisService,

    private readonly gatewayService: GatewayService,

    private readonly authService: AuthService,

    bus: WsBusService,
    presence: WsPresenceService,
  ) {
    super('web', bus, presence)
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

  async sendOnlineNumber() {
    return {
      online: await this.getCurrentClientCount(),
      timestamp: new Date().toISOString(),
    }
  }

  async getCurrentClientCount() {
    const ids = await this.presence.connectionIds('web')
    if (ids.length === 0) return 0

    const metas = await this.gatewayService.getSocketMetadataMany(ids)
    return uniqBy(metas, (x) => x?.sessionId).length
  }

  async handleConnection(ws: WebSocket, request: IncomingMessage) {
    const conn = this.trackConnection(ws)
    const query = parseQuery(request)

    const sessionId = query.get('socket_session_id') || conn.id
    const rawLang = query.get('lang')
    const lang = rawLang && LANG_PATTERN.test(rawLang) ? rawLang : undefined
    const readerId = await this.resolveReaderId(request)

    await this.presence.addConnection('web', conn.id)
    await this.gatewayService.setSocketMetadata(conn, {
      sessionId,
      connectedAt: Date.now(),
      ...(lang ? { lang } : {}),
      ...(readerId ? { readerId } : {}),
    })

    if (lang) {
      this.roomManager.join(langRoom(lang), conn)
      await this.presence.joinRoom('web', langRoom(lang), conn.id)
    }

    this.whenUserOnline()
    this.sendConnectGreeting(conn)
    this.hooks.onConnected.forEach((fn) => fn(conn))

    this.sendOnlineNumber()
      .then((data) => {
        this.sendTo(conn, BusinessEvents.VISITOR_ONLINE, data)
      })
      .catch(() => {})
  }

  async handleDisconnect(ws: WebSocket) {
    const conn = this.resolveConnection(ws)
    if (!conn) return

    const meta = await this.gatewayService.getSocketMetadata(conn)
    const leftRooms = await this.releaseConnection(conn)

    this.sendDisconnectGreeting(conn)
    this.broadcast(BusinessEvents.VISITOR_OFFLINE, {
      ...(await this.sendOnlineNumber()),
      sessionId: meta?.sessionId,
    })

    this.hooks.onDisconnected.forEach((fn) => fn(conn))
    leftRooms.forEach((room) => {
      this.hooks.onLeaveRoom.forEach((fn) => fn(conn, room))
    })

    this.gatewayService.clearSocketMetadata(conn)
  }

  @SubscribeMessage(WsInboundEvents.ping)
  handlePing(@MessageBody() envelope: WsEnvelope) {
    return envelope.id ? buildAck(envelope.id, { ok: true }) : undefined
  }

  @SubscribeMessage(WsInboundEvents.roomJoin)
  async handleRoomJoin(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = roomPayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'ROOM_INVALID' })
    }

    const room = parsed.data.room
    this.roomManager.join(room, conn)
    await this.presence.joinRoom('web', room, conn.id)
    this.logger.log(`Connection ${conn.id} joined room [${room}]`)
    this.hooks.onJoinRoom.forEach((fn) => fn(conn, room))

    const roomJoinedAtMap = await this.getSocketRoomJoinedAtMap(conn)
    roomJoinedAtMap[room] = Date.now()
    await this.gatewayService.setSocketMetadata(conn, { roomJoinedAtMap })

    this.notifyMessageHooks(conn, envelope)
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.roomLeave)
  async handleRoomLeave(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = roomPayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'ROOM_INVALID' })
    }

    const room = parsed.data.room
    this.roomManager.leave(room, conn)
    await this.presence.leaveRoom('web', room, conn.id)
    this.hooks.onLeaveRoom.forEach((fn) => fn(conn, room))

    const roomJoinedAtMap = await this.getSocketRoomJoinedAtMap(conn)
    delete roomJoinedAtMap[room]
    await this.gatewayService.setSocketMetadata(conn, { roomJoinedAtMap })

    this.notifyMessageHooks(conn, envelope)
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.sessionUpdate)
  async handleSessionUpdate(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = sessionUpdatePayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'VALIDATION_FAILED' })
    }

    await this.gatewayService.setSocketMetadata(conn, {
      sessionId: parsed.data.sessionId,
    })
    this.whenUserOnline()

    this.notifyMessageHooks(conn, envelope)
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.langUpdate)
  async handleLangUpdate(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = langUpdatePayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'VALIDATION_FAILED' })
    }

    await this.updateConnectionLang(conn, parsed.data.lang)

    this.notifyMessageHooks(conn, envelope)
    return ack(envelope, { ok: true })
  }

  private notifyMessageHooks(conn: WsConnection, envelope: WsEnvelope) {
    this.hooks.onMessage.forEach((fn) => fn(conn, envelope))
  }

  private async resolveReaderId(
    request: IncomingMessage,
  ): Promise<string | undefined> {
    const cookie = request.headers.cookie
    if (!cookie) return undefined
    const { origin } = request.headers
    try {
      const headers = new Headers()
      headers.set('cookie', cookie)
      if (origin) headers.set('origin', origin)
      const session = await this.authService.getSessionUserFromHeaders(headers)
      const id = session?.user?.id
      return typeof id === 'string' ? id : undefined
    } catch (error) {
      this.logger.debug(
        `resolveReaderId failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return undefined
    }
  }

  private async updateConnectionLang(conn: WsConnection, lang: string) {
    const meta = await this.gatewayService.getSocketMetadata(conn)
    const prevLang = meta?.lang
    if (prevLang) {
      this.roomManager.leave(langRoom(prevLang), conn)
      await this.presence.leaveRoom('web', langRoom(prevLang), conn.id)
    }
    this.roomManager.join(langRoom(lang), conn)
    await this.presence.joinRoom('web', langRoom(lang), conn.id)
    await this.gatewayService.setSocketMetadata(conn, { lang })
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

  public async getSocketsOfRoom(roomName: string): Promise<SocketLike[]> {
    const ids = await this.presence.roomMemberIds('web', roomName)
    return ids.map((id) => ({ id }))
  }

  public async getAllRooms(): Promise<Record<string, SocketLike[]>> {
    const sizes = await this.presence.roomSizes('web')
    const rooms = Object.keys(sizes)
    const members = await Promise.all(
      rooms.map((room) => this.presence.roomMemberIds('web', room)),
    )

    const roomToSocketsMap: Record<string, SocketLike[]> = {}
    rooms.forEach((room, index) => {
      roomToSocketsMap[room] = members[index].map((id) => ({ id }))
    })
    return roomToSocketsMap
  }

  public async getSocketRoomJoinedAtMap(socket: SocketLike) {
    const roomJoinedAtMap =
      (await this.gatewayService.getSocketMetadata(socket))?.roomJoinedAtMap ||
      {}

    return roomJoinedAtMap
  }
}

function ack(envelope: WsEnvelope, payload: { ok: boolean; code?: string }) {
  return envelope.id ? buildAck(envelope.id, payload) : undefined
}

function parseQuery(request: IncomingMessage): URLSearchParams {
  try {
    return new URL(request.url ?? '', 'ws://localhost').searchParams
  } catch {
    return new URLSearchParams()
  }
}

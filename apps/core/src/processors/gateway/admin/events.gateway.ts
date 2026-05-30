import { forwardRef, Inject } from '@nestjs/common'
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
} from '@nestjs/websockets'
import type { BroadcastOperator, Emitter } from '@socket.io/redis-emitter'
import type { DefaultEventsMap } from 'socket.io'
import type SocketIO from 'socket.io'

import { BusinessEvents } from '~/constants/business-event.constant'
import { RedisService } from '~/processors/redis/redis.service'
import { RoomSubsService } from '~/processors/task-queue/task-queue.room-subs.service'

import { AuthService } from '../../../modules/auth/auth.service'
import { createAuthGateway } from '../shared/auth.gateway'

const AI_TASK_ROOM_PREFIX = 'ai-task:'

type AiTaskSubscribePayload = {
  taskId?: string
  groupId?: string
  all?: boolean
}

const AuthGateway = createAuthGateway({ namespace: 'admin' })
@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway
  extends AuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => AuthService))
    protected readonly authService: AuthService,
    private readonly roomSubs: RoomSubsService,
  ) {
    super(authService, redisService)
  }

  async handleDisconnect(client: SocketIO.Socket) {
    // Snapshot rooms before socket.io clears them on disconnect cleanup.
    const rooms = [...client.rooms].filter((room) =>
      room.startsWith(AI_TASK_ROOM_PREFIX),
    )
    super.handleDisconnect(client)
    if (rooms.length === 0) return
    await Promise.all(
      rooms.map(async (room) => {
        try {
          const remaining = await client.nsp.in(room).fetchSockets()
          // The disconnecting socket may still appear in the local set; filter it out.
          const others = remaining.filter((s) => s.id !== client.id)
          if (others.length === 0) {
            await this.roomSubs.remove(room)
          }
        } catch {
          // Best-effort cleanup; TTL will reap stale entries.
        }
      }),
    )
  }

  override broadcast(
    event: BusinessEvents,
    data: any,
    options?: { rooms?: string[]; exclude?: string[] },
  ) {
    let socket = this.redisService.emitter.of('/admin') as
      | Emitter<DefaultEventsMap>
      | BroadcastOperator<DefaultEventsMap>

    if (options?.rooms?.length) {
      socket = socket.in(options.rooms)
    }
    if (options?.exclude?.length) {
      socket = socket.except(options.exclude)
    }

    socket.emit('message', this.gatewayMessageFormat(event, data))
  }

  @SubscribeMessage('ai-agent:join')
  handleJoinSession(
    @ConnectedSocket() client: SocketIO.Socket,
    @MessageBody() payload: { sessionId?: string },
  ) {
    const sessionId = payload?.sessionId?.trim()
    if (sessionId) client.join(`session:${sessionId}`)
  }

  @SubscribeMessage('ai-agent:leave')
  handleLeaveSession(
    @ConnectedSocket() client: SocketIO.Socket,
    @MessageBody() payload: { sessionId?: string },
  ) {
    const sessionId = payload?.sessionId?.trim()
    if (sessionId) client.leave(`session:${sessionId}`)
  }

  @SubscribeMessage('ai-task:subscribe')
  async handleSubscribeAiTask(
    @ConnectedSocket() client: SocketIO.Socket,
    @MessageBody() payload: AiTaskSubscribePayload,
  ) {
    const rooms = resolveAiTaskRooms(payload)
    if (rooms.length === 0) return
    await Promise.all(
      rooms.map(async (room) => {
        client.join(room)
        await this.roomSubs.add(room)
      }),
    )
  }

  @SubscribeMessage('ai-task:unsubscribe')
  async handleUnsubscribeAiTask(
    @ConnectedSocket() client: SocketIO.Socket,
    @MessageBody() payload: AiTaskSubscribePayload,
  ) {
    const rooms = resolveAiTaskRooms(payload)
    if (rooms.length === 0) return
    await Promise.all(
      rooms.map(async (room) => {
        client.leave(room)
        try {
          const remaining = await client.nsp.in(room).fetchSockets()
          const others = remaining.filter((s) => s.id !== client.id)
          if (others.length === 0) {
            await this.roomSubs.remove(room)
          }
        } catch {
          // Best-effort; TTL reaps stale entries.
        }
      }),
    )
  }
}

function resolveAiTaskRooms(
  payload: AiTaskSubscribePayload | undefined,
): string[] {
  if (!payload || typeof payload !== 'object') return []
  const rooms: string[] = []
  if (payload.all === true) rooms.push(`${AI_TASK_ROOM_PREFIX}list`)
  const taskId = typeof payload.taskId === 'string' ? payload.taskId.trim() : ''
  if (taskId) rooms.push(`${AI_TASK_ROOM_PREFIX}detail:${taskId}`)
  const groupId =
    typeof payload.groupId === 'string' ? payload.groupId.trim() : ''
  if (groupId) rooms.push(`${AI_TASK_ROOM_PREFIX}group:${groupId}`)
  return rooms
}

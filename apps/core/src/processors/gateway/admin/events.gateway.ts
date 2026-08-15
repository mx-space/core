import type { WsEnvelope } from '@mx-space/ws-client/protocol'
import { forwardRef, Inject } from '@nestjs/common'
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
import type { WebSocket } from 'ws'

import { RoomSubsService } from '~/processors/task-queue/task-queue.room-subs.service'

import { AuthService } from '../../../modules/auth/auth.service'
import { createAuthGateway } from '../shared/auth.gateway'
import { WsBusService } from '../ws/ws-bus.service'
import { buildAck } from '../ws/ws-envelope'
import {
  aiAgentPayloadSchema,
  type AiTaskPayload,
  aiTaskPayloadSchema,
  WsInboundEvents,
} from '../ws/ws-events'
import { WsPresenceService } from '../ws/ws-presence.service'

const AI_TASK_ROOM_PREFIX = 'ai-task:'

const AuthGateway = createAuthGateway({ namespace: 'admin' })

@WebSocketGateway({ path: '/ws/admin', maxPayload: 1024 * 1024 })
export class AdminEventsGateway
  extends AuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    @Inject(forwardRef(() => AuthService))
    protected readonly authService: AuthService,
    private readonly roomSubs: RoomSubsService,
    bus: WsBusService,
    presence: WsPresenceService,
  ) {
    super(authService, bus, presence)
  }

  override async handleDisconnect(ws: WebSocket) {
    const conn = this.resolveConnection(ws)
    if (!conn) return

    const aiTaskRooms = this.roomManager
      .roomsOf(conn.id)
      .filter((room) => room.startsWith(AI_TASK_ROOM_PREFIX))

    await super.handleDisconnect(ws)
    await this.dropEmptyRoomSubs(aiTaskRooms, conn.id)
  }

  @SubscribeMessage(WsInboundEvents.aiAgentJoin)
  async handleJoinSession(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = aiAgentPayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'VALIDATION_FAILED' })
    }

    const room = `session:${parsed.data.sessionId.trim()}`
    this.roomManager.join(room, conn)
    await this.presence.joinRoom('admin', room, conn.id)
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.aiAgentLeave)
  async handleLeaveSession(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = aiAgentPayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'VALIDATION_FAILED' })
    }

    const room = `session:${parsed.data.sessionId.trim()}`
    this.roomManager.leave(room, conn)
    await this.presence.leaveRoom('admin', room, conn.id)
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.aiTaskSubscribe)
  async handleSubscribeAiTask(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = aiTaskPayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'VALIDATION_FAILED' })
    }

    const rooms = resolveAiTaskRooms(parsed.data)
    await Promise.all(
      rooms.map(async (room) => {
        this.roomManager.join(room, conn)
        await this.presence.joinRoom('admin', room, conn.id)
        await this.roomSubs.add(room)
      }),
    )
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.aiTaskUnsubscribe)
  async handleUnsubscribeAiTask(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = aiTaskPayloadSchema.safeParse(envelope.payload)
    if (!conn || !parsed.success) {
      return ack(envelope, { ok: false, code: 'VALIDATION_FAILED' })
    }

    const rooms = resolveAiTaskRooms(parsed.data)
    await Promise.all(
      rooms.map(async (room) => {
        this.roomManager.leave(room, conn)
        await this.presence.leaveRoom('admin', room, conn.id)
      }),
    )
    await this.dropEmptyRoomSubs(rooms, conn.id)
    return ack(envelope, { ok: true })
  }

  @SubscribeMessage(WsInboundEvents.ping)
  handlePing(@MessageBody() envelope: WsEnvelope) {
    return ack(envelope, { ok: true })
  }

  private async dropEmptyRoomSubs(rooms: string[], selfId: string) {
    if (rooms.length === 0) return
    await Promise.all(
      rooms.map(async (room) => {
        try {
          // roomSubs entries are per-pod, so the emptiness test must be local:
          // a member on another pod keeps its own entry alive, while a global
          // check would leave this pod refreshing a subscription nobody backs.
          const remaining = this.roomManager
            .membersOf(room)
            .filter((member) => member.id !== selfId)
          if (remaining.length === 0) {
            await this.roomSubs.remove(room)
          }
        } catch {
          // Best-effort cleanup; TTL will reap stale entries.
        }
      }),
    )
  }
}

function ack(envelope: WsEnvelope, payload: { ok: boolean; code?: string }) {
  return envelope.id ? buildAck(envelope.id, payload) : undefined
}

function resolveAiTaskRooms(payload: AiTaskPayload): string[] {
  const rooms: string[] = []
  if (payload.all === true) rooms.push(`${AI_TASK_ROOM_PREFIX}list`)
  const taskId = payload.taskId?.trim()
  if (taskId) rooms.push(`${AI_TASK_ROOM_PREFIX}detail:${taskId}`)
  const groupId = payload.groupId?.trim()
  if (groupId) rooms.push(`${AI_TASK_ROOM_PREFIX}group:${groupId}`)
  return rooms
}

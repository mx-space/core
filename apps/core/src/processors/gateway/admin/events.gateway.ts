import { AgentWsEvents } from '@mx-space/ai'
import {
  buildEnvelope,
  type WsAckPayload,
  type WsEnvelope,
} from '@mx-space/ws-client/protocol'
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
import { buildAck, serializeEnvelope } from '../ws/ws-envelope'
import {
  aiAgentPayloadSchema,
  type AiTaskPayload,
  aiTaskPayloadSchema,
  WsInboundEvents,
} from '../ws/ws-events'
import { WsPresenceService } from '../ws/ws-presence.service'
import { AdminWsHandlerRegistry } from './admin-ws-handler.registry'

const AI_TASK_ROOM_PREFIX = 'ai-task:'

const CollabEvents = {
  join: 'collab.join',
  leave: 'collab.leave',
  presence: 'collab.presence',
  update: 'collab.update',
} as const

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
    private readonly handlers: AdminWsHandlerRegistry,
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
    this.handlers.notifyDisconnect(conn.id)
    await this.dropEmptyRoomSubs(aiTaskRooms, conn.id)
  }

  @SubscribeMessage(AgentWsEvents.run)
  handleAgentRun(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(AgentWsEvents.run, envelope, ws)
  }

  @SubscribeMessage(AgentWsEvents.toolResult)
  handleAgentToolResult(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(AgentWsEvents.toolResult, envelope, ws)
  }

  @SubscribeMessage(AgentWsEvents.cancel)
  handleAgentCancel(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(AgentWsEvents.cancel, envelope, ws)
  }

  @SubscribeMessage(AgentWsEvents.steer)
  handleAgentSteer(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(AgentWsEvents.steer, envelope, ws)
  }

  @SubscribeMessage(CollabEvents.join)
  handleCollabJoin(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(CollabEvents.join, envelope, ws)
  }

  @SubscribeMessage(CollabEvents.update)
  handleCollabUpdate(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(CollabEvents.update, envelope, ws)
  }

  @SubscribeMessage(CollabEvents.presence)
  handleCollabPresence(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(CollabEvents.presence, envelope, ws)
  }

  @SubscribeMessage(CollabEvents.leave)
  handleCollabLeave(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    return this.dispatchExtension(CollabEvents.leave, envelope, ws)
  }

  private async dispatchExtension(
    event: string,
    envelope: WsEnvelope,
    ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    if (!conn) return ack(envelope, { ok: false, code: 'NOT_CONNECTED' })
    if (!this.isAuthenticated(conn)) {
      return ack(envelope, { ok: false, code: 'NOT_AUTHENTICATED' })
    }
    const result = await this.handlers.dispatch(
      event,
      {
        alive: () => this.resolveConnection(ws) === conn,
        connectionId: conn.id,
        join: async (room) => {
          this.roomManager.join(room, conn)
          await this.presence.joinRoom('admin', room, conn.id)
        },
        leave: async (room) => {
          this.roomManager.leave(room, conn)
          await this.presence.leaveRoom('admin', room, conn.id)
        },
        send: (name, payload) => {
          if (conn.ws.readyState !== conn.ws.OPEN) return
          conn.ws.send(serializeEnvelope(buildEnvelope(name, payload)))
        },
      },
      envelope.payload,
    )
    return ack(envelope, result)
  }

  @SubscribeMessage(WsInboundEvents.aiAgentJoin)
  async handleJoinSession(
    @MessageBody() envelope: WsEnvelope,
    @ConnectedSocket() ws: WebSocket,
  ) {
    const conn = this.resolveConnection(ws)
    const parsed = aiAgentPayloadSchema.safeParse(envelope.payload)
    if (!conn || !this.isAuthenticated(conn) || !parsed.success) {
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
    if (!conn || !this.isAuthenticated(conn) || !parsed.success) {
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
    if (!conn || !this.isAuthenticated(conn) || !parsed.success) {
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
    if (!conn || !this.isAuthenticated(conn) || !parsed.success) {
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

function ack(envelope: WsEnvelope, payload: WsAckPayload) {
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

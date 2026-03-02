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

import { AuthService } from '../../../modules/auth/auth.service'
import { createAuthGateway } from '../shared/auth.gateway'

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
  ) {
    super(authService, redisService)
  }

  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
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
    if (!sessionId) {
      return
    }
    client.join(`session:${sessionId}`)
  }

  @SubscribeMessage('ai-agent:leave')
  handleLeaveSession(
    @ConnectedSocket() client: SocketIO.Socket,
    @MessageBody() payload: { sessionId?: string },
  ) {
    const sessionId = payload?.sessionId?.trim()
    if (!sessionId) {
      return
    }
    client.leave(`session:${sessionId}`)
  }
}

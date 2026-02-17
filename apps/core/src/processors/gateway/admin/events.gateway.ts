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
import { RedisService } from '~/processors/redis/redis.service'
import type SocketIO from 'socket.io'
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

import { forwardRef, Inject } from '@nestjs/common'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { WebSocketGateway } from '@nestjs/websockets'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { RedisService } from '~/processors/redis/redis.service'
import type SocketIO from 'socket.io'
import { AuthService } from '../../../modules/auth/auth.service'
import { createAuthGateway } from '../shared/auth.gateway'

const AuthGateway = createAuthGateway({ namespace: 'admin', authway: 'jwt' })
@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway
  extends AuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    protected readonly jwtService: JWTService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => AuthService))
    protected readonly authService: AuthService,
  ) {
    super(jwtService, authService, redisService)
  }

  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
  }
}

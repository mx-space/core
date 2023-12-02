import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'

import { forwardRef, Inject } from '@nestjs/common'
import { WebSocketGateway } from '@nestjs/websockets'

import { JWTService } from '~/processors/helper/helper.jwt.service'
import { CacheService } from '~/processors/redis/cache.service'

import { AuthService } from '../../../modules/auth/auth.service'
import { createAuthGateway } from '../shared/auth.gateway'

const AuthGateway = createAuthGateway({
  namespace: 'system',
  authway: 'custom-token',
})

@WebSocketGateway<GatewayMetadata>({ namespace: 'system' })
export class SystemEventsGateway
  extends AuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    protected readonly jwtService: JWTService,
    @Inject(forwardRef(() => AuthService))
    protected readonly authService: AuthService,
    private readonly cacheService: CacheService,
  ) {
    super(jwtService, authService, cacheService)
  }
}

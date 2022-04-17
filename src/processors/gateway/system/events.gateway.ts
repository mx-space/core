import type { JwtService } from '@nestjs/jwt'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { WebSocketGateway } from '@nestjs/websockets'

import type { CacheService } from '~/processors/cache/cache.service'

import type { AuthService } from '../../../modules/auth/auth.service'
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
    protected readonly jwtService: JwtService,
    protected readonly authService: AuthService,
    private readonly cacheService: CacheService,
  ) {
    super(jwtService, authService, cacheService)
  }
}

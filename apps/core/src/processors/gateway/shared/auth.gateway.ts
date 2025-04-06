import { Namespace, Socket } from 'socket.io'

import { OnEvent } from '@nestjs/event-emitter'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { RedisService } from '~/processors/redis/redis.service'

import { BusinessEvents } from '../../../constants/business-event.constant'
import { BroadcastBaseGateway } from '../base.gateway'

export type AuthGatewayOptions = {
  namespace: string
  authway?: 'jwt' | 'custom-token' | 'all'
}

// @ts-ignore
export interface IAuthGateway
  extends OnGatewayConnection,
    OnGatewayDisconnect,
    BroadcastBaseGateway {}

export const createAuthGateway = (
  options: AuthGatewayOptions,
): new (...args: any[]) => IAuthGateway => {
  const { namespace, authway = 'all' } = options
  class AuthGateway extends BroadcastBaseGateway implements IAuthGateway {
    constructor(
      protected readonly jwtService: JWTService,
      protected readonly authService: AuthService,
      private readonly redisService: RedisService,
    ) {
      super()
    }

    @WebSocketServer()
    protected namespace: Namespace

    authFailed(client: Socket) {
      client.send(
        this.gatewayMessageFormat(BusinessEvents.AUTH_FAILED, '认证失败'),
      )
      client.disconnect()
    }

    async authToken(token: string): Promise<boolean> {
      if (typeof token !== 'string') {
        return false
      }
      const validCustomToken = async () => {
        const [verifyCustomToken] =
          await this.authService.verifyCustomToken(token)
        if (verifyCustomToken) {
          return true
        }
        return false
      }

      const validJwt = async () => {
        try {
          const ok = await this.jwtService.verify(token)

          if (!ok) {
            return false
          }
        } catch {
          return false
        }
        // is not crash, is verify
        return true
      }

      switch (authway) {
        case 'custom-token': {
          return await validCustomToken()
        }
        case 'jwt': {
          return await validJwt()
        }
        case 'all': {
          const validCustomTokenResult = await validCustomToken()
          return validCustomTokenResult || (await validJwt())
        }
      }
    }

    async handleConnection(client: Socket) {
      const token =
        client.handshake.query.token ||
        client.handshake.headers.authorization ||
        client.handshake.headers.Authorization
      if (!token) {
        return this.authFailed(client)
      }
      if (!(await this.authToken(token as string))) {
        return this.authFailed(client)
      }

      super.handleConnect(client)

      const sid = client.id
      this.tokenSocketIdMap.set(token.toString(), sid)
    }

    handleDisconnect(client: Socket) {
      super.handleDisconnect(client)
    }
    tokenSocketIdMap = new Map<string, string>()

    @OnEvent(EventBusEvents.TokenExpired)
    handleTokenExpired(token: string) {
      // consola.debug(`token expired: ${token}`)

      const server = this.namespace.server
      const sid = this.tokenSocketIdMap.get(token)
      if (!sid) {
        return false
      }
      const socket = server.of(`/${namespace}`).sockets.get(sid)
      if (socket) {
        socket.disconnect()
        super.handleDisconnect(socket)
        return true
      }
      return false
    }

    override broadcast(event: BusinessEvents, data: any) {
      this.redisService.emitter
        .of(`/${namespace}`)
        .emit('message', this.gatewayMessageFormat(event, data))
    }
  }

  return AuthGateway
}

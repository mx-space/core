import { OnEvent } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { EventBusEvents } from '~/constants/event.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { BaseGateway } from '../base.gateway'
import { EventTypes } from '../events.types'

export abstract class AuthGateway
  extends BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    protected readonly jwtService: JwtService,
    protected readonly authService: AuthService,
  ) {
    super()
  }

  @WebSocketServer()
  protected namespace: Namespace

  async authFailed(client: Socket) {
    client.send(this.gatewayMessageFormat(EventTypes.AUTH_FAILED, '认证失败'))
    client.disconnect()
  }

  async authToken(token: string): Promise<boolean> {
    if (typeof token !== 'string') {
      return false
    }
    // first check this token is custom token in user
    const verifyCustomToken = await this.authService.verifyCustomToken(token)
    if (verifyCustomToken) {
      return true
    } else {
      // if not, then verify jwt token
      try {
        const payload = this.jwtService.verify(token)
        const user = await this.authService.verifyPayload(payload)
        if (!user) {
          return false
        }
      } catch {
        return false
      }
      // is not crash, is verify
      return true
    }
  }
  async handleConnection(client: Socket) {
    const token =
      client.handshake.query.token || client.handshake.headers['authorization']

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
    const server = this.namespace.server
    const sid = this.tokenSocketIdMap.get(token)

    const socket = server.of('/admin').sockets.get(sid)
    if (socket) {
      socket.disconnect()
      super.handleDisconnect(socket)
      return true
    }
    return false
  }
}

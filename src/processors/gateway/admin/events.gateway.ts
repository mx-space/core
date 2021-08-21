/*
 * @Author: Innei
 * @Date: 2020-05-21 11:05:42
 * @LastEditTime: 2020-06-07 13:38:48
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/gateway/admin/events.gateway.ts
 * @MIT
 */

import { JwtService } from '@nestjs/jwt'
import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets'
import { AuthService } from '../../../modules/auth/auth.service'
import { BaseGateway } from '../base.gateway'
import { EventTypes, NotificationTypes } from '../events.types'
import SocketIO from 'socket.io'
@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway
  extends BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {
    super()
  }

  async authFailed(client: SocketIO.Socket) {
    client.send(this.messageFormat(EventTypes.AUTH_FAILED, '认证失败'))
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
  async handleConnection(client: SocketIO.Socket) {
    const token =
      client.handshake.query.token || client.handshake.headers['authorization']

    if (!(await this.authToken(token as string))) {
      return this.authFailed(client)
    }

    this.wsClients.push(client)
    super.handleConnect(client)
  }
  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
  }

  handleTokenExpired(token: string) {
    this.wsClients.some((client) => {
      const _token =
        client.handshake.query.token ||
        client.handshake.headers['authorization']
      if (token === _token) {
        client.disconnect()
        super.handleDisconnect(client)
        return true
      }
      return false
    })
  }

  sendNotification({
    payload,
    id,
    type,
  }: {
    payload?: {
      type: NotificationTypes
      message: string
    }
    id: string
    type?: EventTypes
  }) {
    const socket = super.findClientById(id)
    if (!socket) {
      throw new WsException('Socket 未找到, 无法发送消息')
    }
    socket.send(
      super.messageFormat(type ?? EventTypes.ADMIN_NOTIFICATION, payload),
    )
  }
}

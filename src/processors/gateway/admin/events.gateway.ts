import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets'
import SocketIO, { Socket } from 'socket.io'
import { AuthService } from '../../../modules/auth/auth.service'
import { BaseGateway } from '../base.gateway'
import { EventTypes, NotificationTypes } from '../events.types'
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
    this.bindStdOut()
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

    super.handleConnect(client)
  }

  @SubscribeMessage('unlog')
  unsubscribeStdOut(client: Socket) {
    const idx = this.subscribeStdOutClient.findIndex(
      (client_) => client_ === client,
    )
    Logger.debug(chalk.yellow(client.id, idx))
    if (~idx) {
      this.subscribeStdOutClient.splice(idx, 1)
    }
  }
  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.unsubscribeStdOut(client)
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

  subscribeStdOutClient: Socket[] = []

  @SubscribeMessage('log')
  async subscribeStdOut(client: Socket) {
    if (
      this.subscribeStdOutClient.includes(client) ||
      this.subscribeStdOutClient.some((client_) => client_.id === client.id)
    ) {
      return
    }
    this.subscribeStdOutClient.push(client)
    Logger.debug(
      chalk.yellow(client.id, this.subscribeStdOutClient.length),
      'SubscribeStdOut',
    )
  }

  bindStdOut() {
    const handler = (data: any) => {
      this.subscribeStdOutClient.forEach((client) => {
        client.send(this.messageFormat(EventTypes.STDOUT, data))
      })
    }
    const stream = {
      stdout: process.stdout.write,
      stderr: process.stderr.write,
    }

    process.stdout.write = function (...rest: any[]) {
      handler(rest[0])

      return stream.stdout.apply(this, rest)
    }
    process.stderr.write = function (...rest: any[]) {
      handler(rest[0])

      return stream.stderr.apply(this, rest)
    }
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

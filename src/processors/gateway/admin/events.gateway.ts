import { Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Emitter } from '@socket.io/redis-emitter'
import SocketIO, { Socket } from 'socket.io'
import { EventBusEvents } from '~/constants/event.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { AuthService } from '../../../modules/auth/auth.service'
import { BaseGateway } from '../base.gateway'
import { EventTypes } from '../events.types'
@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway
  extends BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly cacheService: CacheService,
  ) {
    super()
    this.bindStdOut()
  }

  tokenSocketIdMap = new Map<string, string>()

  @WebSocketServer()
  private namespace: SocketIO.Namespace

  async authFailed(client: SocketIO.Socket) {
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
  async handleConnection(client: SocketIO.Socket) {
    const token =
      client.handshake.query.token || client.handshake.headers['authorization']

    if (!(await this.authToken(token as string))) {
      return this.authFailed(client)
    }

    super.handleConnect(client)

    const sid = client.id
    this.tokenSocketIdMap.set(token.toString(), sid)
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
        client.send(this.gatewayMessageFormat(EventTypes.STDOUT, data))
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

  broadcast(event: EventTypes, data: any) {
    const client = new Emitter(this.cacheService.getClient())
    client.of('/admin').emit('message', this.gatewayMessageFormat(event, data))
  }
}

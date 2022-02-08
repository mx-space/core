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
import { resolve } from 'path'
import SocketIO, { Socket } from 'socket.io'
import { EventBusEvents } from '~/constants/event.constant'
import { LOG_DIR } from '~/constants/path.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getTodayLogFilePath } from '~/utils/consola.util'
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

  subscribeSocketToHandlerMap = new Map<string, Function>()

  @SubscribeMessage('log')
  async subscribeStdOut(client: Socket) {
    if (this.subscribeSocketToHandlerMap.has(client.id)) {
      return
    }

    const queue = [] as Function[]
    const handler = (data) => {
      queue.push(() =>
        client.send(this.gatewayMessageFormat(EventTypes.STDOUT, data)),
      )

      queue.shift()()
    }

    this.subscribeSocketToHandlerMap.set(client.id, handler)
    this.cacheService.subscribe('log', handler)

    fs.createReadStream(resolve(LOG_DIR, getTodayLogFilePath()), {
      encoding: 'utf-8',
      highWaterMark: 20,
    }).on('data', handler)
  }

  @SubscribeMessage('unlog')
  unsubscribeStdOut(client: Socket) {
    const cb = this.subscribeSocketToHandlerMap.get(client.id)
    if (cb) {
      this.cacheService.unsubscribe('log', cb as any)
    }
    this.subscribeSocketToHandlerMap.delete(client.id)
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

  broadcast(event: EventTypes, data: any) {
    const client = new Emitter(this.cacheService.getClient())
    client.of('/admin').emit('message', this.gatewayMessageFormat(event, data))
  }
}

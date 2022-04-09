import { resolve } from 'path'
import SocketIO, { Socket } from 'socket.io'

import { JwtService } from '@nestjs/jwt'
import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'

import { LOG_DIR } from '~/constants/path.constant'
import { getTodayLogFilePath } from '~/global/consola.global'
import { CacheService } from '~/processors/cache/cache.service'

import { BusinessEvents } from '../../../constants/business-event.constant'
import { AuthService } from '../../../modules/auth/auth.service'
import { createAuthGateway } from '../shared/auth.gateway'

const AuthGateway = createAuthGateway({ namespace: 'admin', authway: 'jwt' })
@WebSocketGateway<GatewayMetadata>({ namespace: 'admin' })
export class AdminEventsGateway
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

  subscribeSocketToHandlerMap = new WeakMap<Socket, Function>()

  @SubscribeMessage('log')
  async subscribeStdOut(client: Socket, data?: { prevLog?: boolean }) {
    const { prevLog = true } = data || {}
    if (this.subscribeSocketToHandlerMap.has(client)) {
      return
    }

    const handler = (data) => {
      client.send(this.gatewayMessageFormat(BusinessEvents.STDOUT, data))
    }

    this.subscribeSocketToHandlerMap.set(client, handler)
    if (prevLog) {
      const stream = fs
        .createReadStream(resolve(LOG_DIR, getTodayLogFilePath()), {
          encoding: 'utf-8',
          highWaterMark: 32 * 1024,
        })
        .on('data', handler)
        .on('end', () => {
          this.cacheService.subscribe('log', handler)
          stream.close()
        })
    } else {
      this.cacheService.subscribe('log', handler)
    }
  }

  @SubscribeMessage('unlog')
  unsubscribeStdOut(client: Socket) {
    const cb = this.subscribeSocketToHandlerMap.get(client)
    if (cb) {
      this.cacheService.unsubscribe('log', cb as any)
    }
    this.subscribeSocketToHandlerMap.delete(client)
  }

  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.unsubscribeStdOut(client)
  }
}

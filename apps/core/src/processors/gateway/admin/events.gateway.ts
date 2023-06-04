import { resolve } from 'path'
import SocketIO, { Socket } from 'socket.io'

import {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'

import { LOG_DIR } from '~/constants/path.constant'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { CacheService } from '~/processors/redis/cache.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'
import { getTodayLogFilePath } from '~/utils/path.util'

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
    protected readonly jwtService: JWTService,
    protected readonly authService: AuthService,
    private readonly cacheService: CacheService,
    private readonly subpub: SubPubBridgeService,
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
          this.subpub.subscribe('log', handler)
          stream.close()
        })
    } else {
      this.subpub.subscribe('log', handler)
    }
  }

  @SubscribeMessage('unlog')
  unsubscribeStdOut(client: Socket) {
    const cb = this.subscribeSocketToHandlerMap.get(client)
    if (cb) {
      this.subpub.unsubscribe('log', cb as any)
    }
    this.subscribeSocketToHandlerMap.delete(client)
  }

  handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.unsubscribeStdOut(client)
  }
}

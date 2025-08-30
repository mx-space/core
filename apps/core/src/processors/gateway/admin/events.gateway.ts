import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import { forwardRef, Inject } from '@nestjs/common'
import type {
  GatewayMetadata,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets'
import { LOG_DIR } from '~/constants/path.constant'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { RedisService } from '~/processors/redis/redis.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'
import { getTodayLogFilePath } from '~/utils/path.util'
import { Socket } from 'socket.io'
import type SocketIO from 'socket.io'
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
    private readonly redisService: RedisService,
    private readonly subpub: SubPubBridgeService,
    @Inject(forwardRef(() => AuthService))
    protected readonly authService: AuthService,
  ) {
    super(jwtService, authService, redisService)
  }

  subscribeSocketToHandlerMap = new WeakMap<Socket, Function>()

  @SubscribeMessage('log')
  subscribeStdOut(client: Socket, data?: { prevLog?: boolean }) {
    const { prevLog = true } = data || {}
    if (this.subscribeSocketToHandlerMap.has(client)) {
      return
    }

    const handler = (data) => {
      client.send(this.gatewayMessageFormat(BusinessEvents.STDOUT, data))
    }

    this.subscribeSocketToHandlerMap.set(client, handler)
    if (prevLog) {
      const stream = createReadStream(resolve(LOG_DIR, getTodayLogFilePath()), {
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

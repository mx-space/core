import { OnEvent } from '@nestjs/event-emitter'
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { WebSocketServer } from '@nestjs/websockets'
import type { BroadcastOperator, Emitter } from '@socket.io/redis-emitter'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { RedisService } from '~/processors/redis/redis.service'
import type { DefaultEventsMap, Namespace, Socket } from 'socket.io'
import { BusinessEvents } from '../../../constants/business-event.constant'
import { BroadcastBaseGateway } from '../base.gateway'

export type AuthGatewayOptions = {
  namespace: string
}

// @ts-ignore
export interface IAuthGateway
  extends OnGatewayConnection, OnGatewayDisconnect, BroadcastBaseGateway {}

export const createAuthGateway = (
  options: AuthGatewayOptions,
): new (...args: any[]) => IAuthGateway => {
  const { namespace } = options
  class AuthGateway extends BroadcastBaseGateway implements IAuthGateway {
    constructor(
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

    async handleConnection(client: Socket) {
      const cookie = client.handshake.headers.cookie as string | undefined
      const origin = client.handshake.headers.origin as string | undefined
      if (cookie) {
        const headers = new Headers()
        headers.set('cookie', cookie)
        if (origin) {
          headers.set('origin', origin)
        }
        const session =
          await this.authService.getSessionUserFromHeaders(headers)
        if (session?.user?.role === 'owner') {
          super.handleConnect(client)
          if (session.session?.token) {
            this.tokenSocketIdMap.set(session.session.token, client.id)
          }
          return
        }
      }

      const headerApiKey = client.handshake.headers['x-api-key']
      const headerAuthorization = client.handshake.headers.authorization
      const apiKey =
        (Array.isArray(headerApiKey) ? headerApiKey[0] : headerApiKey) ||
        (Array.isArray(headerAuthorization)
          ? headerAuthorization[0]
          : headerAuthorization) ||
        (client.handshake.query.token as string | undefined)
      if (!apiKey) {
        return this.authFailed(client)
      }

      const token = apiKey.replace(/^bearer\s+/i, '')
      if (!this.authService.isCustomToken(token)) {
        return this.authFailed(client)
      }
      const result = await this.authService.verifyApiKey(token)
      if (!result || !(await this.authService.isOwnerReaderId(result.userId))) {
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

    override broadcast(
      event: BusinessEvents,
      data: any,
      options?: {
        rooms?: string[]
        exclude?: string[]
      },
    ) {
      let socket = this.redisService.emitter.of(`/${namespace}`) as
        | Emitter<DefaultEventsMap>
        | BroadcastOperator<DefaultEventsMap>

      if (options?.rooms?.length) {
        socket = socket.in(options.rooms)
      }
      if (options?.exclude?.length) {
        socket = socket.except(options.exclude)
      }

      socket.emit('message', this.gatewayMessageFormat(event, data))
    }
  }

  return AuthGateway
}

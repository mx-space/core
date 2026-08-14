import type { IncomingMessage } from 'node:http'

import { OnEvent } from '@nestjs/event-emitter'
import type { WebSocket } from 'ws'

import { EventBusEvents } from '~/constants/event-bus.constant'
import { AuthService } from '~/modules/auth/auth.service'

import { BusinessEvents } from '../../../constants/business-event.constant'
import type { WsConnection, WsNamespace } from '../ws/ws.types'
import { WsBusService } from '../ws/ws-bus.service'
import { WsGatewayBase } from '../ws/ws-gateway.base'
import { WsPresenceService } from '../ws/ws-presence.service'

export type AuthGatewayOptions = {
  namespace: WsNamespace
}

const AUTH_FAILED_CLOSE_CODE = 4401

export const createAuthGateway = (options: AuthGatewayOptions) => {
  const { namespace } = options

  class AuthGateway extends WsGatewayBase {
    constructor(
      protected readonly authService: AuthService,
      bus: WsBusService,
      presence: WsPresenceService,
    ) {
      super(namespace, bus, presence)
    }

    tokenSocketIdMap = new Map<string, string>()
    private readonly socketIdTokenMap = new Map<string, string>()

    protected bindToken(token: string, conn: WsConnection) {
      this.tokenSocketIdMap.set(token, conn.id)
      this.socketIdTokenMap.set(conn.id, token)
    }

    protected unbindToken(conn: WsConnection) {
      const token = this.socketIdTokenMap.get(conn.id)
      if (!token) return
      this.socketIdTokenMap.delete(conn.id)
      if (this.tokenSocketIdMap.get(token) === conn.id) {
        this.tokenSocketIdMap.delete(token)
      }
    }

    authFailed(conn: WsConnection) {
      this.sendTo(conn, BusinessEvents.AUTH_FAILED, 'Authentication failed')
      conn.ws.close(AUTH_FAILED_CLOSE_CODE, 'auth failed')
    }

    async handleConnection(ws: WebSocket, request: IncomingMessage) {
      const conn = this.trackConnection(ws)
      await this.presence.addConnection(namespace, conn.id)

      const { cookie, origin } = request.headers
      if (cookie) {
        const headers = new Headers()
        headers.set('cookie', cookie)
        if (origin) {
          headers.set('origin', origin)
        }
        const session =
          await this.authService.getSessionUserFromHeaders(headers)
        if (session?.user?.role === 'owner') {
          this.sendConnectGreeting(conn)
          if (session.session?.token) {
            this.bindToken(session.session.token, conn)
          }
          return
        }
      }

      const headerApiKey = request.headers['x-api-key']
      const headerAuthorization = request.headers.authorization
      const apiKey =
        (Array.isArray(headerApiKey) ? headerApiKey[0] : headerApiKey) ||
        headerAuthorization ||
        queryToken(request)
      if (!apiKey) {
        return this.authFailed(conn)
      }

      const token = apiKey.replace(/^bearer\s+/i, '')
      const result = await this.authService.verifyApiKey(token)
      if (
        !result ||
        !(await this.authService.isOwnerReaderId(result.referenceId))
      ) {
        return this.authFailed(conn)
      }

      this.sendConnectGreeting(conn)
      this.bindToken(token, conn)
    }

    async handleDisconnect(ws: WebSocket) {
      const conn = this.resolveConnection(ws)
      if (!conn) return

      await this.releaseConnection(conn)
      this.unbindToken(conn)
      this.sendDisconnectGreeting(conn)
    }

    @OnEvent(EventBusEvents.TokenExpired)
    handleTokenExpired(token: string) {
      const id = this.tokenSocketIdMap.get(token)
      if (!id) {
        return false
      }
      const conn = this.registry.get(id)
      if (!conn) {
        this.tokenSocketIdMap.delete(token)
        return false
      }

      conn.ws.close(AUTH_FAILED_CLOSE_CODE, 'token expired')
      void this.handleDisconnect(conn.ws)
      return true
    }
  }

  return AuthGateway
}

function queryToken(request: IncomingMessage): string | undefined {
  try {
    return (
      new URL(request.url ?? '', 'ws://localhost').searchParams.get('token') ??
      undefined
    )
  } catch {
    return undefined
  }
}

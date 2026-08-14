import { buildEnvelope } from '@mx-space/ws-client/protocol'

import { BusinessEvents } from '~/constants/business-event.constant'

import type { WsConnection } from './ws/ws.types'
import { serializeEnvelope } from './ws/ws-envelope'

export abstract class BaseGateway {
  protected sendTo(conn: WsConnection, event: string, payload?: unknown) {
    if (conn.ws.readyState !== conn.ws.OPEN) return
    conn.ws.send(serializeEnvelope(buildEnvelope(event, payload)))
  }

  protected sendConnectGreeting(conn: WsConnection) {
    this.sendTo(conn, BusinessEvents.GATEWAY_CONNECT, 'WebSocket connected')
  }

  protected sendDisconnectGreeting(conn: WsConnection) {
    this.sendTo(
      conn,
      BusinessEvents.GATEWAY_DISCONNECT,
      'WebSocket disconnected',
    )
  }

  abstract broadcast(
    event: BusinessEvents,
    data: any,
    options?: { rooms?: string[]; exclude?: string[] },
  ): void
}

export abstract class BroadcastBaseGateway extends BaseGateway {}

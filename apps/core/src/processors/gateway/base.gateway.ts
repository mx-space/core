import type { Socket } from 'socket.io'

import { BusinessEvents } from '~/constants/business-event.constant'

export abstract class BaseGateway {
  public gatewayMessageFormat(
    type: BusinessEvents,
    message: any,
    code?: number,
  ) {
    return {
      type,
      data: structuredClone(message),
      code,
    }
  }

  handleDisconnect(client: Socket) {
    client.send(
      this.gatewayMessageFormat(
        BusinessEvents.GATEWAY_CONNECT,
        'WebSocket 断开',
      ),
    )
  }
  handleConnect(client: Socket) {
    client.send(
      this.gatewayMessageFormat(
        BusinessEvents.GATEWAY_CONNECT,
        'WebSocket 已连接',
      ),
    )
  }

  abstract broadcast(
    event: BusinessEvents,
    data: any,
    options?: { rooms?: string[]; exclude?: string[] },
  ): void
}

export abstract class BroadcastBaseGateway extends BaseGateway {}

import { BusinessEvents } from '~/constants/business-event.constant'
import type { Socket } from 'socket.io'

export abstract class BaseGateway {
  public gatewayMessageFormat(
    type: BusinessEvents,
    message: any,
    code?: number,
  ) {
    return {
      type,
      data: JSON.parse(JSON.stringify(message)),
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

  // eslint-disable-next-line unused-imports/no-unused-vars
  broadcast(event: BusinessEvents, data: any) {}
}

export abstract class BroadcastBaseGateway extends BaseGateway {}

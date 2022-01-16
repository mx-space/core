import { Socket } from 'socket.io'
import { EventTypes } from './events.types'

export abstract class BaseGateway {
  public gatewayMessageFormat(type: EventTypes, message: any) {
    return {
      type,
      data: message,
    }
  }

  handleDisconnect(client: Socket) {
    client.send(
      this.gatewayMessageFormat(EventTypes.GATEWAY_CONNECT, 'WebSocket 断开'),
    )
  }
  handleConnect(client: Socket) {
    client.send(
      this.gatewayMessageFormat(EventTypes.GATEWAY_CONNECT, 'WebSocket 已连接'),
    )
  }
}

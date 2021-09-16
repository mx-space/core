import { WebSocketServer } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { EventTypes } from './events.types'
export function gatewayMessageFormat(type: EventTypes, message: any) {
  return {
    type,
    data: message,
  }
}
export class BaseGateway {
  @WebSocketServer()
  server: Server
  wsClients: Socket[] = []

  async broadcast(event: EventTypes, message: any) {
    // this.server.clients().send()
    for (const c of this.wsClients) {
      c.send(gatewayMessageFormat(event, message))
    }
  }
  get messageFormat() {
    return gatewayMessageFormat
  }
  handleDisconnect(client: Socket) {
    for (let i = 0; i < this.wsClients.length; i++) {
      if (this.wsClients[i].id === client.id) {
        this.wsClients.splice(i, 1)
        break
      }
    }
    client.send(
      gatewayMessageFormat(EventTypes.GATEWAY_CONNECT, 'WebSocket 断开'),
    )
  }
  handleConnect(client: Socket) {
    this.wsClients.push(client)
    client.send(
      gatewayMessageFormat(EventTypes.GATEWAY_CONNECT, 'WebSocket 已连接'),
    )
  }
  findClientById(id: string) {
    return this.wsClients.find((socket) => socket.id === id)
  }
}

import type { Socket } from 'socket.io'

export type HookFunction = (socket: Socket) => any
export type HookWithDataFunction = (socket: Socket, data: unknown) => any

export type EventGatewayHooks = {
  onConnected: HookFunction[]
  onDisconnected: HookFunction[]
  onMessage: HookWithDataFunction[]
}

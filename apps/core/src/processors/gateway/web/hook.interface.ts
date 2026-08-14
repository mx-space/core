import type { WsConnection } from '../ws/ws.types'

export type HookFunction = (conn: WsConnection) => any
export type HookWithDataFunction = (conn: WsConnection, data: unknown) => any
export type RoomHookFunction = (conn: WsConnection, roomName: string) => any

export type EventGatewayHooks = {
  onConnected: HookFunction[]
  onDisconnected: HookFunction[]
  onMessage: HookWithDataFunction[]
  onJoinRoom: RoomHookFunction[]
  onLeaveRoom: RoomHookFunction[]
}

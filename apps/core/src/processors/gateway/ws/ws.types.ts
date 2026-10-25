import type { WebSocket } from 'ws'

export type WsNamespace = 'web' | 'admin'

export type WsBusChannel = WsNamespace | 'collab'

export interface WsConnection {
  id: string
  ws: WebSocket
}

export interface WsBusFrame {
  ns: WsBusChannel
  event: string
  payload?: unknown
  rooms?: string[]
  exclude?: string[]
}

export interface WsLocalSnapshot {
  conns: string[]
  rooms: Record<string, string[]>
}

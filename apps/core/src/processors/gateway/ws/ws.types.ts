import type { WebSocket } from 'ws'

export type WsNamespace = 'web' | 'admin'

export interface WsConnection {
  id: string
  ws: WebSocket
}

export interface WsBusFrame {
  ns: WsNamespace
  event: string
  payload?: unknown
  rooms?: string[]
  exclude?: string[]
}

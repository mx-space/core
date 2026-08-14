import { randomUUID } from 'node:crypto'

import type { WsConnection } from './ws.types'

export function createWsConnectionId(): string {
  return randomUUID()
}

export class WsConnectionRegistry {
  private readonly connections = new Map<string, WsConnection>()

  add(conn: WsConnection): void {
    this.connections.set(conn.id, conn)
  }

  remove(id: string): void {
    this.connections.delete(id)
  }

  get(id: string): WsConnection | undefined {
    return this.connections.get(id)
  }

  all(): WsConnection[] {
    return [...this.connections.values()]
  }

  get size(): number {
    return this.connections.size
  }
}

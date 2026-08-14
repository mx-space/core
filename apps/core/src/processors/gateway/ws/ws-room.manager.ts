import type { WsConnection } from './ws.types'

export class WsRoomManager {
  private readonly roomToConns = new Map<string, Set<WsConnection>>()
  private readonly idToRooms = new Map<string, Set<string>>()

  join(room: string, conn: WsConnection): void {
    let members = this.roomToConns.get(room)
    if (!members) {
      members = new Set()
      this.roomToConns.set(room, members)
    }
    members.add(conn)

    let rooms = this.idToRooms.get(conn.id)
    if (!rooms) {
      rooms = new Set()
      this.idToRooms.set(conn.id, rooms)
    }
    rooms.add(room)
  }

  leave(room: string, conn: WsConnection): void {
    const members = this.roomToConns.get(room)
    if (members) {
      members.delete(conn)
      if (members.size === 0) this.roomToConns.delete(room)
    }

    const rooms = this.idToRooms.get(conn.id)
    if (rooms) {
      rooms.delete(room)
      if (rooms.size === 0) this.idToRooms.delete(conn.id)
    }
  }

  leaveAll(conn: WsConnection): string[] {
    const rooms = this.idToRooms.get(conn.id)
    if (!rooms) return []

    const left = [...rooms]
    for (const room of left) {
      const members = this.roomToConns.get(room)
      if (!members) continue
      members.delete(conn)
      if (members.size === 0) this.roomToConns.delete(room)
    }
    this.idToRooms.delete(conn.id)

    return left
  }

  membersOf(room: string): WsConnection[] {
    return [...(this.roomToConns.get(room) ?? [])]
  }

  roomsOf(id: string): string[] {
    return [...(this.idToRooms.get(id) ?? [])]
  }
}

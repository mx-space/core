import { describe, expect, it } from 'vitest'

import type { WsConnection } from '~/processors/gateway/ws/ws.types'
import { WsRoomManager } from '~/processors/gateway/ws/ws-room.manager'

function fakeConn(id: string): WsConnection {
  return { id, ws: {} as WsConnection['ws'] }
}

describe('WsRoomManager', () => {
  it('join adds member and tracks room membership', () => {
    const manager = new WsRoomManager()
    const conn = fakeConn('a')

    manager.join('room1', conn)

    expect(manager.membersOf('room1')).toEqual([conn])
    expect(manager.roomsOf('a')).toEqual(['room1'])
  })

  it('leave removes member and evicts empty room', () => {
    const manager = new WsRoomManager()
    const conn = fakeConn('a')
    manager.join('room1', conn)

    manager.leave('room1', conn)

    expect(manager.membersOf('room1')).toEqual([])
    expect(manager.roomsOf('a')).toEqual([])
  })

  it('leave keeps room alive while other members remain', () => {
    const manager = new WsRoomManager()
    const connA = fakeConn('a')
    const connB = fakeConn('b')
    manager.join('room1', connA)
    manager.join('room1', connB)

    manager.leave('room1', connA)

    expect(manager.membersOf('room1')).toEqual([connB])
    expect(manager.roomsOf('a')).toEqual([])
  })

  it('leaveAll removes conn from every joined room and returns them', () => {
    const manager = new WsRoomManager()
    const conn = fakeConn('a')
    manager.join('room1', conn)
    manager.join('room2', conn)

    const left = manager.leaveAll(conn).sort()

    expect(left).toEqual(['room1', 'room2'])
    expect(manager.roomsOf('a')).toEqual([])
    expect(manager.membersOf('room1')).toEqual([])
    expect(manager.membersOf('room2')).toEqual([])
  })

  it('leaveAll on a conn with no rooms returns an empty array', () => {
    const manager = new WsRoomManager()

    expect(manager.leaveAll(fakeConn('ghost'))).toEqual([])
  })

  it('membersOf/roomsOf return empty arrays for unknown keys', () => {
    const manager = new WsRoomManager()

    expect(manager.membersOf('unknown-room')).toEqual([])
    expect(manager.roomsOf('unknown-id')).toEqual([])
  })

  it('leaving a room a conn never joined is a no-op', () => {
    const manager = new WsRoomManager()
    const conn = fakeConn('a')

    expect(() => manager.leave('room1', conn)).not.toThrow()
    expect(manager.membersOf('room1')).toEqual([])
  })
})

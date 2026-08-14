import { buildEnvelope } from '@mx-space/ws-client/protocol'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { WebSocket } from 'ws'

import type { BusinessEvents } from '~/constants/business-event.constant'

import { BroadcastBaseGateway } from '../base.gateway'
import type { WsBusFrame, WsConnection, WsNamespace } from './ws.types'
import type { WsBusService } from './ws-bus.service'
import {
  createWsConnectionId,
  WsConnectionRegistry,
} from './ws-connection.registry'
import { serializeEnvelope } from './ws-envelope'
import type { WsPresenceService } from './ws-presence.service'
import { WsRoomManager } from './ws-room.manager'

const HEARTBEAT_INTERVAL_MS = 30_000

export abstract class WsGatewayBase
  extends BroadcastBaseGateway
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly registry = new WsConnectionRegistry()
  protected readonly roomManager = new WsRoomManager()

  private readonly connectionByWs = new WeakMap<WebSocket, WsConnection>()
  private readonly aliveSockets = new WeakSet<WebSocket>()
  private heartbeatTimer?: ReturnType<typeof setInterval>
  private unregisterBus?: () => void

  protected constructor(
    protected readonly namespace: WsNamespace,
    protected readonly bus: WsBusService,
    protected readonly presence: WsPresenceService,
  ) {
    super()
  }

  onModuleInit() {
    this.unregisterBus = this.bus.register(this.namespace, (frame) =>
      this.deliverLocal(frame),
    )
    this.heartbeatTimer = setInterval(
      () => this.sweepHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    )
    this.heartbeatTimer.unref?.()
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = undefined
    this.unregisterBus?.()
    this.unregisterBus = undefined
  }

  protected trackConnection(ws: WebSocket): WsConnection {
    const conn: WsConnection = { id: createWsConnectionId(), ws }
    this.connectionByWs.set(ws, conn)
    this.registry.add(conn)
    this.aliveSockets.add(ws)
    ws.on('pong', () => this.aliveSockets.add(ws))
    return conn
  }

  protected untrackConnection(conn: WsConnection) {
    this.connectionByWs.delete(conn.ws)
    this.aliveSockets.delete(conn.ws)
    this.registry.remove(conn.id)
  }

  protected resolveConnection(ws: WebSocket): WsConnection | undefined {
    return this.connectionByWs.get(ws)
  }

  protected async releaseConnection(conn: WsConnection): Promise<string[]> {
    const leftRooms = this.roomManager.leaveAll(conn)
    this.untrackConnection(conn)

    await this.presence.removeConnection(this.namespace, conn.id)
    await Promise.all(
      leftRooms.map((room) =>
        this.presence.leaveRoom(this.namespace, room, conn.id),
      ),
    )

    return leftRooms
  }

  override broadcast(
    event: BusinessEvents,
    data: any,
    options?: { rooms?: string[]; exclude?: string[] },
  ) {
    this.bus.publish({
      ns: this.namespace,
      event,
      payload: data,
      rooms: options?.rooms,
      exclude: options?.exclude,
    })
  }

  protected deliverLocal(frame: WsBusFrame) {
    const targets = this.resolveTargets(frame)
    if (targets.length === 0) return

    const message = serializeEnvelope(buildEnvelope(frame.event, frame.payload))
    for (const conn of targets) {
      if (conn.ws.readyState !== conn.ws.OPEN) continue
      conn.ws.send(message)
    }
  }

  private resolveTargets(frame: WsBusFrame): WsConnection[] {
    const pool = frame.rooms?.length
      ? this.collectRoomTargets(frame.rooms)
      : this.registry.all()

    const exclude = frame.exclude
    if (!exclude?.length) return pool

    const excluded = new Set(exclude)
    return pool.filter((conn) => !excluded.has(conn.id))
  }

  private collectRoomTargets(rooms: string[]): WsConnection[] {
    const targets = new Map<string, WsConnection>()
    for (const room of rooms) {
      for (const conn of this.roomManager.membersOf(room)) {
        targets.set(conn.id, conn)
      }
      // A connection id is itself addressable as a room, so callers can target
      // individual clients by putting ids in `rooms`.
      const direct = this.registry.get(room)
      if (direct) targets.set(direct.id, direct)
    }
    return [...targets.values()]
  }

  private sweepHeartbeat() {
    for (const conn of this.registry.all()) {
      if (conn.ws.readyState !== conn.ws.OPEN) continue
      if (!this.aliveSockets.has(conn.ws)) {
        conn.ws.terminate()
        continue
      }
      this.aliveSockets.delete(conn.ws)
      conn.ws.ping()
    }
  }
}

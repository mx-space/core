import { randomBytes } from 'node:crypto'
import { hostname } from 'node:os'

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

import { RedisService } from '../../redis/redis.service'
import type { WsNamespace } from './ws.types'

const NODE_TTL_SECONDS = 30
const HEARTBEAT_MS = 10_000
const SWEEP_MS = 60_000
const WS_NAMESPACES: WsNamespace[] = ['web', 'admin']

// KEYS[1] = room hash, KEYS[2] = rooms set, ARGV[1] = room name, ARGV[2..] = member ids to HDEL first (optional)
const ROOM_PRUNE_SCRIPT = `
if #ARGV > 1 then
  redis.call('HDEL', KEYS[1], unpack(ARGV, 2))
end
if redis.call('HLEN', KEYS[1]) == 0 then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[1])
  return 1
end
return 0
`

@Injectable()
export class WsPresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WsPresenceService.name)
  readonly nodeId = `${hostname()}-${process.pid}-${randomBytes(2).toString('hex')}`

  private heartbeatTimer?: ReturnType<typeof setInterval>
  private sweepTimer?: ReturnType<typeof setInterval>

  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient()
  }

  private nodeKey(): string {
    return getRedisKey(RedisKeys.WsNode, this.nodeId)
  }

  private nodesKey(): string {
    return getRedisKey(RedisKeys.WsNodes)
  }

  private connsKey(ns: WsNamespace): string {
    return getRedisKey(RedisKeys.WsConns, ns)
  }

  private roomKey(ns: WsNamespace, room: string): string {
    return getRedisKey(RedisKeys.WsRoom, ns, room)
  }

  private roomsKey(ns: WsNamespace): string {
    return getRedisKey(RedisKeys.WsRooms, ns)
  }

  private async pruneRoomIfEmpty(
    ns: WsNamespace,
    room: string,
    memberIdsToRemove: string[] = [],
  ): Promise<void> {
    await this.redis.eval(
      ROOM_PRUNE_SCRIPT,
      2,
      this.roomKey(ns, room),
      this.roomsKey(ns),
      room,
      ...memberIdsToRemove,
    )
  }

  async onModuleInit(): Promise<void> {
    await this.heartbeat()
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), HEARTBEAT_MS)
    this.heartbeatTimer.unref?.()
    this.sweepTimer = setInterval(() => void this.sweepOnce(), SWEEP_MS)
    this.sweepTimer.unref?.()
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    this.heartbeatTimer = undefined
    this.sweepTimer = undefined

    // Reclaim our own conn/room entries before deregistering: sweepOnce only
    // discovers node ids still in the nodes set, so anything left behind after
    // the srem below would be unreclaimable phantom state.
    await this.sweepDeadNode(this.nodeId).catch(() => undefined)
    await this.redis.del(this.nodeKey()).catch(() => undefined)
    await this.redis.srem(this.nodesKey(), this.nodeId).catch(() => undefined)
  }

  private async heartbeat(): Promise<void> {
    try {
      await this.redis.set(this.nodeKey(), '1', 'EX', NODE_TTL_SECONDS)
      await this.redis.sadd(this.nodesKey(), this.nodeId)
    } catch (error) {
      this.warn('Failed to send ws presence heartbeat', error)
    }
  }

  async addConnection(ns: WsNamespace, id: string): Promise<void> {
    try {
      await this.redis.hset(this.connsKey(ns), id, this.nodeId)
    } catch (error) {
      this.warn('Failed to register ws connection', error)
    }
  }

  async removeConnection(ns: WsNamespace, id: string): Promise<void> {
    try {
      await this.redis.hdel(this.connsKey(ns), id)
    } catch (error) {
      this.warn('Failed to remove ws connection', error)
    }
  }

  async joinRoom(ns: WsNamespace, room: string, id: string): Promise<void> {
    try {
      await this.redis.hset(this.roomKey(ns, room), id, this.nodeId)
      await this.redis.sadd(this.roomsKey(ns), room)
    } catch (error) {
      this.warn('Failed to join ws room', error)
    }
  }

  async leaveRoom(ns: WsNamespace, room: string, id: string): Promise<void> {
    try {
      await this.pruneRoomIfEmpty(ns, room, [id])
    } catch (error) {
      this.warn('Failed to leave ws room', error)
    }
  }

  async roomMemberIds(ns: WsNamespace, room: string): Promise<string[]> {
    try {
      return await this.redis.hkeys(this.roomKey(ns, room))
    } catch (error) {
      this.warn('Failed to read ws room members', error)
      return []
    }
  }

  async connectionIds(ns: WsNamespace): Promise<string[]> {
    try {
      return await this.redis.hkeys(this.connsKey(ns))
    } catch (error) {
      this.warn('Failed to read ws connections', error)
      return []
    }
  }

  async roomSizes(ns: WsNamespace): Promise<Record<string, number>> {
    try {
      const rooms = await this.redis.smembers(this.roomsKey(ns))
      if (rooms.length === 0) return {}

      const pipeline = this.redis.pipeline()
      for (const room of rooms) pipeline.hlen(this.roomKey(ns, room))
      const results = await pipeline.exec()

      const sizes: Record<string, number> = {}
      const empties: string[] = []
      results?.forEach(([err, value], index) => {
        const room = rooms[index]
        if (err) {
          this.warn(`Failed to read ws room size for "${room}"`, err)
          return
        }
        const size = typeof value === 'number' ? value : 0
        if (size === 0) {
          empties.push(room)
          return
        }
        sizes[room] = size
      })

      if (empties.length > 0) {
        await Promise.all(
          empties.map((room) => this.pruneRoomIfEmpty(ns, room)),
        )
      }

      return sizes
    } catch (error) {
      this.warn('Failed to read ws room sizes', error)
      return {}
    }
  }

  async sweepOnce(): Promise<void> {
    try {
      const nodeIds = await this.redis.smembers(this.nodesKey())
      for (const nodeId of nodeIds) {
        const alive = await this.redis.exists(
          getRedisKey(RedisKeys.WsNode, nodeId),
        )
        if (alive) continue
        await this.sweepDeadNode(nodeId)
      }
    } catch (error) {
      this.warn('Failed to sweep ws presence', error)
    }
  }

  private async sweepDeadNode(deadNodeId: string): Promise<void> {
    for (const ns of WS_NAMESPACES) {
      const conns = await this.redis.hgetall(this.connsKey(ns))
      const deadIds = Object.entries(conns)
        .filter(([, owner]) => owner === deadNodeId)
        .map(([id]) => id)

      if (deadIds.length > 0) {
        await this.redis.hdel(this.connsKey(ns), ...deadIds)
        await this.redis.hdel(getRedisKey(RedisKeys.Socket), ...deadIds)
      }

      const rooms = await this.redis.smembers(this.roomsKey(ns))
      for (const room of rooms) {
        const members = await this.redis.hgetall(this.roomKey(ns, room))
        const deadMembers = Object.entries(members)
          .filter(([, owner]) => owner === deadNodeId)
          .map(([id]) => id)
        if (deadMembers.length === 0) continue

        await this.pruneRoomIfEmpty(ns, room, deadMembers)
      }
    }

    await this.redis.srem(this.nodesKey(), deadNodeId)
  }

  private warn(message: string, error: unknown): void {
    this.logger.warn(
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

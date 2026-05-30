import { randomBytes } from 'node:crypto'

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'

import { getRedisKey } from '~/utils/redis.util'

import { RedisService } from '../redis/redis.service'

const ROOM_SUBS_KEY_PREFIX = 'task-queue:room-subs'
const ROOM_SUBS_TTL_SECONDS = 5 * 60
const ROOM_SUBS_HEARTBEAT_MS = 60 * 1000

function roomKey(room: string): string {
  return `${ROOM_SUBS_KEY_PREFIX}:${room}`
}

@Injectable()
export class RoomSubsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomSubsService.name)
  private readonly subscribed = new Set<string>()
  private heartbeat: NodeJS.Timeout | null = null

  // Always append a random suffix to avoid collisions between concurrent local
  // dev processes that share a HOSTNAME (e.g. two pnpm dev shells).
  readonly podId = `${process.env.HOSTNAME ?? 'local'}-${randomBytes(4).toString('hex')}`

  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient()
  }

  private getKey(room: string): string {
    return getRedisKey(roomKey(room) as any)
  }

  async add(room: string): Promise<void> {
    this.subscribed.add(room)
    const key = this.getKey(room)
    await this.redis.sadd(key, this.podId)
    await this.redis.expire(key, ROOM_SUBS_TTL_SECONDS)
  }

  async remove(room: string): Promise<void> {
    this.subscribed.delete(room)
    const key = this.getKey(room)
    await this.redis.srem(key, this.podId)
  }

  async has(room: string): Promise<boolean> {
    const exists = await this.redis.exists(this.getKey(room))
    return exists === 1
  }

  async refresh(rooms: string[]): Promise<void> {
    await Promise.all(
      rooms.map((room) =>
        this.redis.expire(this.getKey(room), ROOM_SUBS_TTL_SECONDS),
      ),
    )
  }

  onModuleInit(): void {
    this.heartbeat = setInterval(() => {
      const rooms = [...this.subscribed]
      if (rooms.length === 0) return
      void Promise.all(
        rooms.map((room) =>
          this.redis
            .expire(this.getKey(room), ROOM_SUBS_TTL_SECONDS)
            .catch((error: unknown) => {
              this.logger.warn(
                `Failed to refresh room subscription TTL for ${room}: ${(error as Error).message}`,
              )
            }),
        ),
      )
    }, ROOM_SUBS_HEARTBEAT_MS)
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    const rooms = [...this.subscribed]
    this.subscribed.clear()
    // Best-effort cleanup; failures here are tolerable (TTL will reap).
    await Promise.all(
      rooms.map((room) =>
        this.redis.srem(this.getKey(room), this.podId).catch(() => undefined),
      ),
    )
  }
}

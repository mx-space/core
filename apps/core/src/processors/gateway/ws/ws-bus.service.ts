import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import type IORedis from 'ioredis'

import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

import { RedisService } from '../../redis/redis.service'
import type { WsBusFrame, WsNamespace } from './ws.types'

@Injectable()
export class WsBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WsBusService.name)
  private readonly channel = getRedisKey(RedisKeys.WsBus)
  private readonly handlers = new Map<
    WsNamespace,
    (frame: WsBusFrame) => void
  >()

  private subClient?: IORedis
  private subscribed = false

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit(): Promise<void> {
    const subClient = this.redisService.duplicateClient()
    this.subClient = subClient
    subClient.on('message', (_channel, message) => {
      this.handleMessage(message)
    })
    // Every delivery (local included) flows through this subscription, so a
    // one-shot subscribe would leave the whole node broadcast-dead if the
    // first attempt fails. Retry on each `ready` until it sticks; once
    // subscribed, ioredis restores the subscription across reconnects itself.
    subClient.on('ready', () => {
      if (!this.subscribed) void this.trySubscribe(subClient)
    })
    await this.trySubscribe(subClient)
  }

  private async trySubscribe(subClient: IORedis): Promise<void> {
    try {
      // The duplicated client inherits enableOfflineQueue: false, so a
      // subscribe issued before its connection is ready is rejected outright
      // instead of being queued — wait for ready or the bus never delivers.
      await this.redisService.waitForReady(subClient)
      await subClient.subscribe(this.channel)
      this.subscribed = true
    } catch (error) {
      this.warn('Failed to subscribe ws bus channel', error)
    }
  }

  async onModuleDestroy(): Promise<void> {
    const subClient = this.subClient
    this.subClient = undefined
    if (!subClient) return

    try {
      await subClient.unsubscribe(this.channel)
    } catch (error) {
      this.warn('Failed to unsubscribe ws bus channel', error)
    }
    await subClient.quit().catch(() => undefined)
  }

  register(ns: WsNamespace, deliver: (frame: WsBusFrame) => void): () => void {
    this.handlers.set(ns, deliver)
    return () => {
      if (this.handlers.get(ns) === deliver) this.handlers.delete(ns)
    }
  }

  publish(frame: WsBusFrame): void {
    void this.redisService
      .getClient()
      .publish(this.channel, JSON.stringify(frame))
      .catch((error: unknown) => {
        this.warn('Failed to publish ws bus frame', error)
      })
  }

  private handleMessage(message: string): void {
    let frame: WsBusFrame
    try {
      frame = JSON.parse(message)
    } catch (error) {
      this.warn('Dropped malformed ws bus frame', error)
      return
    }

    const handler = this.handlers.get(frame?.ns)
    handler?.(frame)
  }

  private warn(message: string, error: unknown): void {
    this.logger.warn(
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

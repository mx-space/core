import { Logger } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import type IORedis from 'ioredis'
import type { Server } from 'socket.io'

import type { RedisService } from '~/processors/redis/redis.service'

export const RedisIoAdapterKey = 'mx-core-socket'

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name)
  private pubClient?: IORedis
  private subClient?: IORedis

  constructor(
    app: any,
    private readonly redisService: RedisService,
  ) {
    super(app)
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options) as Server

    this.pubClient ??= this.redisService.duplicateClient()
    this.subClient ??= this.redisService.duplicateClient()

    void Promise.all([
      this.redisService.waitForReady(this.pubClient),
      this.redisService.waitForReady(this.subClient),
    ])
      .then(() => {
        const redisAdapter = createAdapter(this.pubClient!, this.subClient!, {
          key: RedisIoAdapterKey,
          requestsTimeout: 5000,
          publishOnSpecificResponseChannel: true,
        })
        server.adapter(redisAdapter)
      })
      .catch((error) => {
        this.logger.error(
          `RedisIoAdapter initialization skipped: ${error instanceof Error ? error.message : String(error)}`,
        )
      })

    return server
  }
}

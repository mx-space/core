import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import type { Server } from 'socket.io'

import { redisSubPub } from '~/utils/redis-subpub.util'

export const RedisIoAdapterKey = 'mx-core-socket'

export class RedisIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options) as Server

    const { pubClient, subClient } = redisSubPub

    const redisAdapter = createAdapter(pubClient, subClient, {
      key: RedisIoAdapterKey,
      requestsTimeout: 5000,
      publishOnSpecificResponseChannel: true,
    })
    server.adapter(redisAdapter)
    return server
  }
}

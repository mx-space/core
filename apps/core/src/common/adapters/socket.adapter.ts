import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import { redisSubPub } from '~/utils/redis-subpub.util'

export const RedisIoAdapterKey = 'mx-core-socket'
export class RedisIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options)

    const { pubClient, subClient } = redisSubPub

    const redisAdapter = createAdapter(pubClient, subClient, {
      key: RedisIoAdapterKey,
      requestsTimeout: 10000,
    })
    server.adapter(redisAdapter)
    return server
  }
}

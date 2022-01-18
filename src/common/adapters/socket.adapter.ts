import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { redisSubPub } from '~/utils/redis-subpub.util'

export class RedisIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options)

    const { pubClient, subClient } = redisSubPub

    const redisAdapter = createAdapter(pubClient, subClient)
    server.adapter(redisAdapter)
    return server
  }
}

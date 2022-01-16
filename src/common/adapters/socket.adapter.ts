import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import IORedis from 'ioredis'
import { REDIS } from '~/app.config'

export class RedisIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, options)
    const pubClient = new IORedis({ host: REDIS.host, port: REDIS.port })
    const subClient = pubClient.duplicate()

    const redisAdapter = createAdapter(pubClient, subClient)
    server.adapter(redisAdapter)
    return server
  }
}

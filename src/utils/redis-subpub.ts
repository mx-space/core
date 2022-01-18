import IORedis from 'ioredis'
import { REDIS } from '~/app.config'
class RedisSubPub {
  public pubClient: IORedis.Redis
  public subClient: IORedis.Redis
  constructor(private channelPrefix: string = 'mx-channel#') {
    const pubClient = new IORedis({ host: REDIS.host, port: REDIS.port })
    const subClient = pubClient.duplicate()
    this.pubClient = pubClient
    this.subClient = subClient
  }
  public async publish(event: string, data: any) {
    const channel = this.channelPrefix + event
    await this.pubClient.publish(channel, JSON.stringify(data))
  }

  public async subscribe(event: string, callback: (data: any) => void) {
    const channel = this.channelPrefix + event
    this.subClient.subscribe(channel)
    this.subClient.on('message', (channel, message) => {
      callback(JSON.parse(message))
    })
  }
}

export const redisSubPub = new RedisSubPub()

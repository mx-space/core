import IORedis from 'ioredis'
import { REDIS } from '~/app.config'
import { isTest } from './tool.util'
class RedisSubPub {
  public pubClient: IORedis.Redis
  public subClient: IORedis.Redis
  constructor(private channelPrefix: string = 'mx-channel#') {
    if (!isTest) {
      this.init()
    } else {
      !process.env.CI && console.error('[RedisSubPub] 在测试环境不可用！')
    }
  }

  public init() {
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

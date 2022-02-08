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

  ctc = new Map<Function, Callback>()

  public async subscribe(event: string, callback: (data: any) => void) {
    const channel = this.channelPrefix + event
    this.subClient.subscribe(channel)
    const cb = (channel, message) => {
      callback(JSON.parse(message))
    }

    this.ctc.set(callback, cb)
    this.subClient.on('message', cb)
  }

  public async unsubscribe(event: string, callback: (data: any) => void) {
    const channel = this.channelPrefix + event
    this.subClient.unsubscribe(channel)
    const cb = this.ctc.get(callback)
    if (cb) {
      this.subClient.off('message', cb)

      this.ctc.delete(callback)
    }
  }
}

export const redisSubPub = new RedisSubPub()

type Callback = (channel: string, message: string) => void

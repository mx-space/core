import { Logger } from '@nestjs/common'
import { REDIS } from '~/app.config'
import IORedis from 'ioredis'
import type { Redis, RedisOptions } from 'ioredis'
import { isTest } from '../global/env.global'

class RedisSubPub {
  private readonly logger = new Logger(RedisSubPub.name)
  public pubClient: Redis
  public subClient: Redis
  constructor(private channelPrefix: string = 'mx-channel#') {
    if (!isTest) {
      this.init()
    } else {
      // !process.env.CI && console.error('[RedisSubPub] 在测试环境不可用！')
    }
  }

  public init() {
    const baseOptions: RedisOptions = {
      host: REDIS.host,
      port: REDIS.port,
      username: (REDIS as any).username,
      db: (REDIS as any).db,
      ...(REDIS.tls ? { tls: {} } : {}),
    }

    if (REDIS.password) {
      baseOptions.password = REDIS.password
    }

    const pubClient = REDIS.url
      ? new IORedis(REDIS.url, baseOptions)
      : new IORedis(baseOptions)
    const subClient = pubClient.duplicate()
    this.pubClient = pubClient
    this.subClient = subClient
  }
  public async publish(event: string, data: any) {
    const channel = this.channelPrefix + event
    const _data = JSON.stringify(data)
    if (event !== 'log') {
      this.logger.debug(`发布事件：${channel} <- ${_data}`)
    }
    await this.pubClient.publish(channel, _data)
  }

  private ctc = new WeakMap<Function, Callback>()

  public subscribe(event: string, callback: (data: any) => void) {
    const myChannel = this.channelPrefix + event
    this.subClient.subscribe(myChannel)

    const cb = (channel, message) => {
      if (channel === myChannel) {
        if (event !== 'log') {
          this.logger.debug(`接收事件：${channel} -> ${message}`)
        }
        callback(JSON.parse(message))
      }
    }

    this.ctc.set(callback, cb)
    this.subClient.on('message', cb)
  }

  public unsubscribe(event: string, callback: (data: any) => void) {
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

export type { RedisSubPub }

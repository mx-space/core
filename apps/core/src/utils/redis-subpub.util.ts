import { Logger } from '@nestjs/common'
import { REDIS } from '~/app.config'
import IORedis from 'ioredis'
import type { Redis, RedisOptions } from 'ioredis'
import { isTest } from '../global/env.global'

class RedisSubPub {
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
    const redisOptions: RedisOptions = {
      host: REDIS.host,
      port: REDIS.port,
    }

    if (REDIS.password) {
      redisOptions.password = REDIS.password
    }

    const pubClient = new IORedis(redisOptions)
    const subClient = pubClient.duplicate()
    this.pubClient = pubClient
    this.subClient = subClient
  }
  public async publish(event: string, data: any) {
    const channel = this.channelPrefix + event
    const _data = JSON.stringify(data)
    if (event !== 'log') {
      Logger.debug(`发布事件：${channel} <- ${_data}`, RedisSubPub.name)
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
          Logger.debug(`接收事件：${channel} -> ${message}`, RedisSubPub.name)
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

import { isAsyncFunction } from 'util/types'
import { Redis } from 'ioredis'

import { Injectable } from '@nestjs/common'

import { safeJSONParse } from '~/utils'

import { CacheService } from '../redis/cache.service'

type ITask = RedisMap<
  string,
  {
    status: 'pending' | 'fulfill' | 'reject'
    updatedAt: Date
    message?: string
  }
>

@Injectable()
export class TaskQueueService {
  tasks: ITask
  constructor(private readonly redis: CacheService) {
    this.tasks = new RedisMap(redis.getClient(), 'tq')
  }

  add(name: string, task: () => Promise<any>) {
    this.tasks.set(name, { status: 'pending', updatedAt: new Date() })

    if (isAsyncFunction(task)) {
      task()
        .then(() => {
          this.tasks.set(name, { status: 'fulfill', updatedAt: new Date() })
        })
        .catch((err) => {
          console.debug(err)

          this.tasks.set(name, {
            status: 'reject',
            updatedAt: new Date(),
            message: err.message,
          })
        })
    } else {
      try {
        task()
        this.tasks.set(name, { status: 'fulfill', updatedAt: new Date() })
      } catch (err) {
        console.debug(err)

        this.tasks.set(name, {
          status: 'reject',
          updatedAt: new Date(),
          message: err.message,
        })
      }
    }
  }

  async get(name: string) {
    const task = await this.tasks.get(name)
    return !task ? null : { ...task }
  }
}

class RedisMap<K extends string, V = unknown> {
  constructor(
    private readonly redis: Redis,
    private readonly hashName: string,
  ) {
    this.hashName = `${RedisMap.key}${hashName}#`
  }

  static key = 'redis-map#'
  async get(key: K) {
    const res = await this.redis.hget(this.hashName, key)

    return safeJSONParse(res) as V | null
  }
  set(key: K, data: V) {
    return this.redis.hset(this.hashName, key, JSON.stringify(data))
  }
}

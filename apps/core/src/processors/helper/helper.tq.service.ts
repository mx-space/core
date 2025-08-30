import { isAsyncFunction } from 'node:util/types'
import { Injectable } from '@nestjs/common'
import { safeJSONParse } from '~/utils/tool.util'
import type { Redis } from 'ioredis'
import { RedisService } from '../redis/redis.service'

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
  constructor(private readonly redisService: RedisService) {
    this.tasks = new RedisMap(redisService.getClient(), 'tq')
  }

  add(name: string, task: () => Promise<any>) {
    this.tasks.set(name, { status: 'pending', updatedAt: new Date() })

    if (isAsyncFunction(task)) {
      task()
        .then(() => {
          this.tasks.set(name, { status: 'fulfill', updatedAt: new Date() })
        })
        .catch((error) => {
          console.debug(error)

          this.tasks.set(name, {
            status: 'reject',
            updatedAt: new Date(),
            message: error.message,
          })
        })
    } else {
      try {
        task()
        this.tasks.set(name, { status: 'fulfill', updatedAt: new Date() })
      } catch (error) {
        console.debug(error)

        this.tasks.set(name, {
          status: 'reject',
          updatedAt: new Date(),
          message: error.message,
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

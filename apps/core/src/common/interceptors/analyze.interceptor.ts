/**
 * Analyze interceptor.
 * @file 数据分析拦截器
 * @module interceptor/analyze
 * @author Innei <https://github.com/Innei>
 */
import { URL } from 'node:url'
import { isbot } from 'isbot'
import { UAParser } from 'ua-parser-js'
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import type { Observable } from 'rxjs'

import { Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ReturnModelType } from '@typegoose/typegoose'

import { RedisKeys } from '~/constants/cache.constant'
import * as SYSTEM from '~/constants/system.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { RedisService } from '~/processors/redis/redis.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { InjectModel } from '~/transformers/model.transformer'
import { getIp } from '~/utils/ip.util'
import { getRedisKey } from '~/utils/redis.util'
import { scheduleManager } from '~/utils/schedule.util'

@Injectable()
export class AnalyzeInterceptor implements NestInterceptor {
  private parser: UAParser
  private queue: TaskQueuePool<any>

  constructor(
    @InjectModel(AnalyzeModel)
    private readonly model: ReturnModelType<typeof AnalyzeModel>,
    @InjectModel(OptionModel)
    private readonly options: ReturnModelType<typeof OptionModel>,
    private readonly redisService: RedisService,
    @Inject(REFLECTOR) private readonly reflector: Reflector,
  ) {
    this.init()
    this.queue = new TaskQueuePool(1000, this.model, async (count) => {
      await this.options.updateOne(
        { name: 'apiCallTime' },
        {
          $inc: {
            value: count,
          },
        },
        { upsert: true },
      )
    })
  }

  async init() {
    this.parser = new UAParser()
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    const call$ = next.handle()
    const request = getNestExecutionContextRequest(context)
    if (!request) {
      return call$
    }

    const method = request.method.toUpperCase()
    if (method !== 'GET') {
      return call$
    }

    const shouldSkipLogging = this.reflector.get(
      SYSTEM.SKIP_LOGGING_METADATA,
      context.getHandler(),
    )

    if (shouldSkipLogging) return call$

    const ip = getIp(request)

    // if req from SSR server, like 127.0.0.1, skip
    if (['127.0.0.1', 'localhost', '::-1'].includes(ip)) {
      return call$
    }
    // if login
    if (request.user) {
      return call$
    }

    // if user agent is in bot list, skip
    if (isbot(request.headers['user-agent'])) {
      return call$
    }

    const url = request.url.replace(/^\/api(\/v\d)?/, '')

    if (url.startsWith('/proxy')) {
      return call$
    }

    scheduleManager.schedule(async () => {
      try {
        request.headers['user-agent'] &&
          this.parser.setUA(request.headers['user-agent'])

        const ua = this.parser.getResult()

        this.queue.push({
          ip,
          ua,
          path: new URL(`http://a.com${url}`).pathname,
          country:
            request.headers['cf-ipcountry'] || request.headers['CF-IPCountry'],
        })

        // ip access in redis
        const client = this.redisService.getClient()

        const count = await client.sadd(getRedisKey(RedisKeys.AccessIp), ip)
        if (count) {
          // record uv to db

          const uvRecord = await this.options.findOne({ name: 'uv' })
          if (uvRecord) {
            await uvRecord.updateOne({
              $inc: {
                value: 1,
              },
            })
          } else {
            await this.options.create({
              name: 'uv',
              value: 1,
            })
          }
        }
      } catch (error) {
        console.error(error)
      }
    })

    return call$
  }
}

class TaskQueuePool<T> {
  private pool: T[] = []
  private interval: number
  private timer: NodeJS.Timer | null = null

  constructor(
    interval: number = 1000,
    private readonly collection: any,
    private onBatch: (count: number) => any,
  ) {
    this.interval = interval
  }

  push(model: T) {
    this.pool.push(model)

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.batchInsert()
        this.timer = null
      }, this.interval)
    }
  }

  private async batchInsert() {
    if (this.pool.length === 0) return

    await this.collection.insertMany(this.pool)
    await this.onBatch(this.pool.length)
    // 清空任务池，准备下一次批量插入
    this.pool = []
  }
}

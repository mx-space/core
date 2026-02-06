import { URL } from 'node:url'
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { ReturnModelType } from '@typegoose/typegoose'
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
import { isbot } from 'isbot'
import { Observable } from 'rxjs'
import { UAParser } from 'ua-parser-js'

@Injectable()
export class AnalyzeInterceptor implements NestInterceptor {
  private readonly parser = new UAParser()
  private readonly queue: TaskQueuePool<any>

  constructor(
    @InjectModel(AnalyzeModel)
    private readonly model: ReturnModelType<typeof AnalyzeModel>,
    @InjectModel(OptionModel)
    private readonly options: ReturnModelType<typeof OptionModel>,
    private readonly redisService: RedisService,
    @Inject(REFLECTOR) private readonly reflector: Reflector,
  ) {
    this.queue = new TaskQueuePool(1000, this.model, async (count) => {
      await this.options.updateOne(
        { name: 'apiCallTime' },
        { $inc: { value: count } },
        { upsert: true },
      )
    })
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

    if (request.method.toUpperCase() !== 'GET') {
      return call$
    }

    const shouldSkipLogging = this.reflector.get(
      SYSTEM.SKIP_LOGGING_METADATA,
      context.getHandler(),
    )
    if (shouldSkipLogging) return call$

    const ip = getIp(request)

    if (['127.0.0.1', 'localhost', '::-1'].includes(ip)) {
      return call$
    }

    if (request.user) {
      return call$
    }

    if (isbot(request.headers['user-agent'])) {
      return call$
    }

    const url = request.url.replace(/^\/api(\/v\d)?/, '')

    if (url.startsWith('/proxy')) {
      return call$
    }

    scheduleManager.schedule(async () => {
      try {
        if (request.headers['user-agent']) {
          this.parser.setUA(request.headers['user-agent'])
        }

        const ua = this.parser.getResult()

        this.queue.push({
          ip,
          ua,
          path: new URL(`http://a.com${url}`).pathname,
          country:
            request.headers['cf-ipcountry'] || request.headers['CF-IPCountry'],
          referer: request.headers.referer || request.headers.Referer,
        })

        const client = this.redisService.getClient()
        const count = await client.sadd(getRedisKey(RedisKeys.AccessIp), ip)
        if (count) {
          await this.options.updateOne(
            { name: 'uv' },
            { $inc: { value: 1 } },
            { upsert: true },
          )
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
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly interval: number = 1000,
    private readonly collection: any,
    private readonly onBatch: (count: number) => any,
  ) {}

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
    this.pool = []
  }
}

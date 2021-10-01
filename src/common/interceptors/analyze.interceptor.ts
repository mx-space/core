/**
 * Analyze interceptor.
 * @file 数据分析拦截器
 * @module interceptor/analyze
 * @author Innei <https://github.com/Innei>
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { FastifyRequest } from 'fastify'
import { readFileSync } from 'fs'
import { InjectModel } from 'nestjs-typegoose'
import { Observable } from 'rxjs'
import UAParser from 'ua-parser-js'
import { URL } from 'url'
import { RedisKeys } from '~/constants/cache.constant'
import { LOCAL_BOT_LIST_DATA_FILE_PATH } from '~/constants/path.constant'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { CacheService } from '~/processors/cache/cache.service'
import { CronService } from '~/processors/helper/helper.cron.service'
import { TaskQueueService } from '~/processors/helper/helper.tq.service'
import { getIp } from '~/utils/ip.util'
import { getRedisKey } from '~/utils/redis.util'

@Injectable()
export class AnalyzeInterceptor implements NestInterceptor {
  private parser: UAParser
  private botListData: RegExp[] = []

  constructor(
    @InjectModel(AnalyzeModel)
    private readonly model: ReturnModelType<typeof AnalyzeModel>,
    @InjectModel(OptionModel)
    private readonly options: ReturnModelType<typeof OptionModel>,
    private readonly cronService: CronService,
    private readonly cacheService: CacheService,
    private readonly taskService: TaskQueueService,
  ) {
    this.init()
  }

  init() {
    this.parser = new UAParser()
    this.botListData = this.getLocalBotList()
    this.taskService.add(this.cronService.updateBotList.name, async () =>
      this.cronService.updateBotList(),
    )
  }

  getLocalBotList() {
    try {
      return this.pickPattern2Regexp(
        JSON.parse(
          readFileSync(LOCAL_BOT_LIST_DATA_FILE_PATH, {
            encoding: 'utf-8',
          }),
        ),
      )
    } catch {
      return []
    }
  }

  private pickPattern2Regexp(data: any): RegExp[] {
    return data.map((item) => new RegExp(item.pattern))
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    const call$ = next.handle()
    const request = this.getRequest(context)
    if (!request) {
      return call$
    }
    const method = request.routerMethod.toUpperCase()
    if (method !== 'GET') {
      return call$
    }
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
    if (this.botListData.some((rg) => rg.test(request.headers['user-agent']))) {
      return call$
    }

    const url = request.url

    try {
      this.parser.setUA(request.headers['user-agent'])

      const ua = this.parser.getResult()

      await this.model.create({
        ip,
        ua,
        path: new URL('http://a.com' + url).pathname,
      })
      const apiCallTimeRecord = await this.options.findOne({
        name: 'apiCallTime',
      })
      if (!apiCallTimeRecord) {
        await this.options.create({
          name: 'apiCallTime',
          value: 1,
        })
      } else {
        await this.options.updateOne(
          { name: 'apiCallTime' },
          {
            $inc: {
              value: 1,
            },
          },
        )
      }
      // ip access in redis
      const client = this.cacheService.getClient()

      const count = await client.sadd(getRedisKey(RedisKeys.Access, 'ips'), ip)
      if (count) {
        // record uv to db
        process.nextTick(async () => {
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
        })
      }
    } catch (e) {
      console.error(e)
    }

    return call$
  }

  getRequest(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<KV>()
    if (req) {
      return req as FastifyRequest & { user?: any }
    }
    return null
  }
}

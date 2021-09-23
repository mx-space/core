import { NestMiddleware } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { readFileSync } from 'fs'
import { IncomingMessage, ServerResponse } from 'http'
import { InjectModel } from 'nestjs-typegoose'
import { UAParser } from 'ua-parser-js'
import { URL } from 'url'
import { RedisKeys } from '~/constants/cache.constant'
import { LOCAL_BOT_LIST_DATA_FILE_PATH } from '~/constants/path.constant'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { OptionModel } from '~/modules/configs/configs.model'
import { CacheService } from '~/processors/cache/cache.service'
import { CronService } from '~/processors/helper/helper.cron.service'
import { getIp } from '~/utils/ip.util'
import { getRedisKey } from '~/utils/redis.util'

export class AnalyzeMiddleware implements NestMiddleware {
  private parser: UAParser
  private botListData: RegExp[] = []

  constructor(
    @InjectModel(AnalyzeModel)
    private readonly model: ReturnModelType<typeof AnalyzeModel>,
    @InjectModel(OptionModel)
    private readonly options: ReturnModelType<typeof OptionModel>,
    private readonly cronService: CronService,
    private readonly cacheService: CacheService,
  ) {
    this.init()
  }

  init() {
    this.parser = new UAParser()
    this.botListData = this.getLocalBotList()
    this.cronService.updateBotList().then((res) => {
      this.botListData = this.pickPattern2Regexp(res)
    })
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

  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const ip = getIp(req)
    // @ts-ignore
    const url = req.originalUrl?.replace(/^\/api(\/v\d)?/, '')

    // if req from SSR server, like 127.0.0.1, skip
    if (['127.0.0.1', 'localhost', '::-1'].includes(ip)) {
      return next()
    }

    // if is login and is master, skip
    if (req.headers['Authorization'] || req.headers['authorization']) {
      return next()
    }

    // if user agent is in bot list, skip
    if (this.botListData.some((rg) => rg.test(req.headers['user-agent']))) {
      return next()
    }

    try {
      this.parser.setUA(req.headers['user-agent'])

      const ua = this.parser.getResult()
      // @ts-ignore
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
              // @ts-ignore
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
    } finally {
      next()
    }
  }
}

import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import dayjs from 'dayjs'
import { mkdirp } from 'mkdirp'
import type { StoreJWTPayload } from './helper.jwt.service'

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { CronExpression } from '@nestjs/schedule'

import { CronDescription } from '~/common/decorators/cron-description.decorator'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import {
  LOG_DIR,
  STATIC_FILE_TRASH_DIR,
  TEMP_DIR,
} from '~/constants/path.constant'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'

import { CacheService } from '../redis/cache.service'
import { RedisService } from '../redis/redis.service'
import { HttpService } from './helper.http.service'
import { JWTService } from './helper.jwt.service'

@Injectable()
export class CronService {
  private logger: Logger
  constructor(
    private readonly http: HttpService,
    private readonly configs: ConfigsService,
    @InjectModel(AnalyzeModel)
    private readonly analyzeModel: MongooseModel<AnalyzeModel>,
    private readonly redisService: RedisService,

    @Inject(forwardRef(() => AggregateService))
    private readonly aggregateService: AggregateService,
  ) {
    this.logger = new Logger(CronService.name)
  }

  @CronOnce(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'cleanAccessRecord',
  })
  @CronDescription('清理访问记录')
  async cleanAccessRecord() {
    const cleanDate = dayjs().add(-7, 'd')

    await this.analyzeModel.deleteMany({
      timestamp: {
        $lte: cleanDate.toDate(),
      },
    })

    this.logger.log('--> 清理访问记录成功')
  }
  /**
   * @description 每天凌晨删除缓存
   */
  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'resetIPAccess' })
  @CronDescription('清理 IP 访问记录')
  async resetIPAccess() {
    await this.redisService.getClient().del(getRedisKey(RedisKeys.AccessIp))

    this.logger.log('--> 清理 IP 访问记录成功')
  }

  /**
   * @description 每天凌晨删除缓存
   */
  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'resetLikedOrReadArticleRecord',
  })
  @CronDescription('清理喜欢数')
  async resetLikedOrReadArticleRecord() {
    const redis = this.redisService.getClient()

    await Promise.all(
      [
        redis.keys(getRedisKey(RedisKeys.Like, '*')),
        redis.keys(getRedisKey(RedisKeys.Read, '*')),
      ].map((keys) => {
        return keys.then((keys) => keys.map((key) => redis.del(key)))
      }),
    )

    this.logger.log('--> 清理喜欢数成功')
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_3AM, { name: 'cleanTempDirectory' })
  @CronDescription('清理临时文件')
  async cleanTempDirectory() {
    await rm(TEMP_DIR, { recursive: true })
    mkdirp.sync(STATIC_FILE_TRASH_DIR)
    this.logger.log('--> 清理临时文件成功')
  }
  // “At 00:05.”
  @CronOnce('5 0 * * *', { name: 'cleanTempDirectory' })
  @CronDescription('清理日志文件')
  async cleanLogFile() {
    const files = (await readdir(LOG_DIR)).filter(
      (file) => file !== 'error.log',
    )
    const rmTaskArr = [] as Promise<any>[]
    for (const file of files) {
      const filePath = join(LOG_DIR, file)
      const state = fs.statSync(filePath)
      const oldThanWeek = dayjs().diff(state.mtime, 'day') > 7
      if (oldThanWeek) {
        rmTaskArr.push(rm(filePath))
      }
    }

    await Promise.all(rmTaskArr)
    this.logger.log('--> 清理日志文件成功')
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'pushToBaiduSearch' })
  @CronDescription('推送到百度搜索')
  async pushToBaiduSearch() {
    const {
      url: { webUrl },
      baiduSearchOptions: configs,
    } = await this.configs.waitForConfigReady()

    if (configs.enable) {
      const token = configs.token
      if (!token) {
        this.logger.error('[BaiduSearchPushTask] token 为空')
        return
      }

      const pushUrls = await this.aggregateService.getSiteMapContent()
      const urls = pushUrls
        .map((item) => {
          return item.url
        })
        .join('\n')

      try {
        const res = await this.http.axiosRef.post(
          `http://data.zz.baidu.com/urls?site=${webUrl}&token=${token}`,
          urls,
          {
            headers: {
              'Content-Type': 'text/plain',
            },
          },
        )
        this.logger.log(`百度站长提交结果：${JSON.stringify(res.data)}`)
        return res.data
      } catch (error) {
        this.logger.error(`百度推送错误：${error.message}`)
        throw error
      }
    }
    return null
  }

  @CronDescription('扫表：删除过期 JWT')
  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'deleteExpiredJWT',
  })
  async deleteExpiredJWT() {
    this.logger.log('--> 开始扫表，清除过期的 token')
    const redis = this.redisService.getClient()
    const keys = await redis.hkeys(getRedisKey(RedisKeys.JWTStore))
    let deleteCount = 0
    await Promise.all(
      keys.map(async (key) => {
        const value = await redis.hget(getRedisKey(RedisKeys.JWTStore), key)
        if (!value) {
          return null
        }
        const parsed = JSON.safeParse(value) as StoreJWTPayload
        if (!parsed) {
          return null
        }

        const date = dayjs(new Date(parsed.date))
        if (date.add(JWTService.expiresDay, 'd').diff(new Date(), 'd') < 0) {
          this.logger.debug(
            `--> 删除过期的 token：${key}, 签发于 ${date.format(
              'YYYY-MM-DD H:mm:ss',
            )}`,
          )

          return await redis
            .hdel(getRedisKey(RedisKeys.JWTStore), key)
            .then(() => {
              deleteCount += 1
            })
        }
        return null
      }),
    )

    this.logger.log(`--> 删除了 ${deleteCount} 个过期的 token`)
  }
}

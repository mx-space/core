import { rm } from 'node:fs/promises'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { RedisKeys } from '~/constants/cache.constant'
import { STATIC_FILE_TRASH_DIR, TEMP_DIR } from '~/constants/path.constant'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import type { StoreJWTPayload } from '~/processors/helper/helper.jwt.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { RedisService } from '~/processors/redis/redis.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'
import dayjs from 'dayjs'
import { mkdirp } from 'mkdirp'

/**
 * CronBusinessService - Cron 任务业务逻辑层
 *
 * 本服务仅保留业务方法的实现，供 CronTaskService 调用
 * 调度逻辑在 CronTaskScheduler 中
 */
@Injectable()
export class CronBusinessService {
  private logger: Logger
  constructor(
    private readonly http: HttpService,
    private readonly configs: ConfigsService,
    @InjectModel(AnalyzeModel)
    private readonly analyzeModel: MongooseModel<AnalyzeModel>,
    private readonly redisService: RedisService,
    private readonly fileReferenceService: FileReferenceService,

    @Inject(forwardRef(() => AggregateService))
    private readonly aggregateService: AggregateService,
  ) {
    this.logger = new Logger(CronBusinessService.name)
  }

  /**
   * 清理 7 天前的访问记录
   */
  async cleanAccessRecord() {
    const cleanDate = dayjs().add(-7, 'd')

    const result = await this.analyzeModel.deleteMany({
      timestamp: {
        $lte: cleanDate.toDate(),
      },
    })

    this.logger.log('--> 清理访问记录成功')
    return { deletedCount: result.deletedCount }
  }

  /**
   * 每天凌晨删除 IP 访问缓存
   */
  async resetIPAccess() {
    await this.redisService.getClient().del(getRedisKey(RedisKeys.AccessIp))

    this.logger.log('--> 清理 IP 访问记录成功')
    return { success: true }
  }

  /**
   * 每天凌晨删除喜欢/阅读记录缓存
   */
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
    return { success: true }
  }

  /**
   * 清理临时文件目录
   */
  async cleanTempDirectory() {
    await rm(TEMP_DIR, { recursive: true })
    mkdirp.sync(STATIC_FILE_TRASH_DIR)
    this.logger.log('--> 清理临时文件成功')
    return { success: true }
  }

  /**
   * 推送站点地图到百度搜索
   */
  async pushToBaiduSearch() {
    const {
      url: { webUrl },
      baiduSearchOptions: configs,
    } = await this.configs.waitForConfigReady()

    if (configs.enable) {
      const token = configs.token
      if (!token) {
        this.logger.error('[BaiduSearchPushTask] token 为空')
        return { skipped: true, reason: 'token is empty' }
      }

      const pushUrls = await this.aggregateService.getSiteMapContent()
      const urls = pushUrls.map((item) => item.url).join('\n')

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
        return { response: res.data }
      } catch (error) {
        this.logger.error(`百度推送错误：${error.message}`)
        throw error
      }
    }
    return { skipped: true, reason: 'Baidu search push is disabled' }
  }

  /**
   * 推送站点地图到 Bing 搜索
   */
  async pushToBingSearch() {
    const {
      url: { webUrl },
      bingSearchOptions: configs,
    } = await this.configs.waitForConfigReady()

    if (!configs.enable) {
      return { skipped: true, reason: 'Bing search push is disabled' }
    }
    const apiKey = configs.token
    if (!apiKey) {
      this.logger.error('[BingSearchPushTask] API key 为空')
      return { skipped: true, reason: 'API key is empty' }
    }

    const pushUrls = await this.aggregateService.getSiteMapContent()
    const urls = pushUrls.map((item) => item.url)

    try {
      const res = await this.http.axiosRef.post(
        `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${apiKey}`,
        {
          siteUrl: webUrl,
          urlList: urls,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      )
      if (res?.data?.d === null) {
        this.logger.log('Bing 站长提交成功')
      } else {
        this.logger.log(`Bing 站长提交结果：${JSON.stringify(res.data)}`)
      }
      return { response: res.data }
    } catch (error) {
      this.logger.error(`Bing 推送错误：${error.message}`)
      throw error
    }
  }

  /**
   * 扫表删除过期的 JWT
   */
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
    return { deletedCount: deleteCount }
  }

  /**
   * 清理孤儿图片
   */
  async cleanupOrphanImages() {
    this.logger.log('--> 开始清理孤儿图片')
    const { deletedCount, totalOrphan } =
      await this.fileReferenceService.cleanupOrphanFiles(60)
    this.logger.log(
      `--> 清理孤儿图片完成：删除了 ${deletedCount}/${totalOrphan} 个文件`,
    )
    return { deletedCount, totalOrphan }
  }
}

import { readdir, rm } from 'fs/promises'
import { join } from 'path'
import dayjs from 'dayjs'
import mkdirp from 'mkdirp'

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { CronExpression } from '@nestjs/schedule'

import { DEMO_MODE } from '~/app.config'
import { CronDescription } from '~/common/decorators/cron-description.decorator'
import { CronOnce } from '~/common/decorators/cron-once.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { LOG_DIR, TEMP_DIR } from '~/constants/path.constant'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { BackupService } from '~/modules/backup/backup.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { NoteService } from '~/modules/note/note.service'
import { PageService } from '~/modules/page/page.service'
import { PostService } from '~/modules/post/post.service'
import { SearchService } from '~/modules/search/search.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils'
import { uploadFileToCOS } from '~/utils/cos.util'
import { getRedisKey } from '~/utils/redis.util'

import { CacheService } from '../redis/cache.service'
import { HttpService } from './helper.http.service'
import { JWTService, StoreJWTPayload } from './helper.jwt.service'

@Injectable()
export class CronService {
  private logger: Logger
  constructor(
    private readonly http: HttpService,
    private readonly configs: ConfigsService,
    @InjectModel(AnalyzeModel)
    private readonly analyzeModel: MongooseModel<AnalyzeModel>,
    private readonly cacheService: CacheService,

    @Inject(forwardRef(() => AggregateService))
    private readonly aggregateService: AggregateService,

    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,

    @Inject(forwardRef(() => NoteService))
    private readonly noteService: NoteService,

    @Inject(forwardRef(() => PageService))
    private readonly pageService: PageService,
    @Inject(forwardRef(() => BackupService))
    private readonly backupService: BackupService,
    @Inject(forwardRef(() => SearchService))
    private readonly searchService: SearchService, // @Inject(forwardRef(() => JWTService)) // private readonly jwtService: JWTService,
  ) {
    this.logger = new Logger(CronService.name)
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, { name: 'backupDB' })
  @CronDescription('备份 DB 并上传 COS')
  async backupDB() {
    if (DEMO_MODE) {
      return
    }
    const backup = await this.backupService.backup()
    if (!backup) {
      this.logger.log('没有开启备份')
      return
    }
    //  开始上传 COS
    scheduleManager.schedule(async () => {
      const { backupOptions } = await this.configs.waitForConfigReady()

      if (
        !backupOptions.bucket ||
        !backupOptions.region ||
        !backupOptions.secretId ||
        !backupOptions.secretKey
      ) {
        return
      }

      this.logger.log('--> 开始上传到 COS')

      await uploadFileToCOS(
        backup.buffer,
        backup.path.slice(backup.path.lastIndexOf('/') + 1),
        {
          bucket: backupOptions.bucket,
          region: backupOptions.region,
          secretId: backupOptions.secretId,
          secretKey: backupOptions.secretKey,
        },
      )
        .then(() => {
          this.logger.log('--> 上传成功')
        })
        .catch((err) => {
          this.logger.error('--> 上传失败了')
          throw err
        })
    })
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
    await this.cacheService.getClient().del(getRedisKey(RedisKeys.AccessIp))

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
    const redis = this.cacheService.getClient()

    await Promise.all(
      [
        redis.keys(getRedisKey(RedisKeys.Like, '*')),
        redis.keys(getRedisKey(RedisKeys.Read, '*')),
      ].map(async (keys) => {
        return keys.then((keys) => keys.map((key) => redis.del(key)))
      }),
    )

    this.logger.log('--> 清理喜欢数成功')
  }

  @CronOnce(CronExpression.EVERY_DAY_AT_3AM, { name: 'cleanTempDirectory' })
  @CronDescription('清理临时文件')
  async cleanTempDirectory() {
    await rm(TEMP_DIR, { recursive: true })
    mkdirp.sync(TEMP_DIR)
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
      } catch (e) {
        this.logger.error(`百度推送错误：${e.message}`)
        throw e
      }
    }
    return null
  }

  /**
   * @description 每天凌晨推送一遍 Algolia Search
   */
  @CronOnce(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'pushToAlgoliaSearch',
  })
  @CronDescription('推送到 Algolia Search')
  @OnEvent(EventBusEvents.PushSearch)
  async pushToAlgoliaSearch() {
    const configs = await this.configs.waitForConfigReady()
    if (!configs.algoliaSearchOptions.enable || isDev) {
      return
    }
    const index = await this.searchService.getAlgoliaSearchIndex()

    this.logger.log('--> 开始推送到 Algolia')
    const documents: Record<'title' | 'text' | 'type' | 'id', string>[] = []
    const combineDocuments = await Promise.all([
      this.postService.model
        .find({ hide: false }, 'title text')
        .lean()
        .then((list) => {
          return list.map((data) => {
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            return {
              ...data,
              type: 'post',
            }
          })
        }),
      this.pageService.model
        .find({}, 'title text')
        .lean()
        .then((list) => {
          return list.map((data) => {
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            return {
              ...data,
              type: 'page',
            }
          })
        }),
      this.noteService.model
        .find(
          {
            hide: false,
            $or: [
              { password: undefined },
              { password: null },
              { password: { $exists: false } },
            ],
          },
          'title text nid',
        )
        .lean()
        .then((list) => {
          return list.map((data) => {
            const id = data.nid.toString()
            Reflect.set(data, 'objectID', data._id)
            Reflect.deleteProperty(data, '_id')
            Reflect.deleteProperty(data, 'nid')
            return {
              ...data,
              type: 'note',
              id,
            }
          })
        }),
    ])
    combineDocuments.forEach((documents_: any) => {
      documents.push(...documents_)
    })
    try {
      await Promise.all([
        index.clearObjects(),
        index.saveObjects(documents, {
          autoGenerateObjectIDIfNotExist: false,
        }),
        index.setSettings({
          attributesToHighlight: ['text', 'title'],
        }),
      ])

      this.logger.log('--> 推送到 algoliasearch 成功')
    } catch (err) {
      Logger.error('algolia 推送错误', 'AlgoliaSearch')
      throw err
    }
  }
  @CronDescription('扫表：删除过期 JWT')
  @CronOnce(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'deleteExpiredJWT',
  })
  async deleteExpiredJWT() {
    this.logger.log('--> 开始扫表，清除过期的 token')
    const redis = this.cacheService.getClient()
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

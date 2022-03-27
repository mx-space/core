import cluster from 'cluster'
import COS from 'cos-nodejs-sdk-v5'
import dayjs from 'dayjs'
import { existsSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import mkdirp from 'mkdirp'
import { join } from 'path'

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'

import { isMainCluster } from '~/app.config'
import { CronDescription } from '~/common/decorator/cron-description.decorator'
import { RedisKeys } from '~/constants/cache.constant'
import { EventBusEvents } from '~/constants/event.constant'
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
import { getRedisKey } from '~/utils/redis.util'

import { CacheService } from '../cache/cache.service'
import { HttpService } from './helper.http.service'

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
    private readonly searchService: SearchService,
  ) {
    this.logger = new Logger(CronService.name)

    if (isMainCluster || cluster.isWorker) {
      Object.getOwnPropertyNames(this.constructor.prototype)
        .filter((name) => name != 'constructor')
        .forEach((name) => {
          const metaKeys = Reflect.getOwnMetadataKeys(this[name])
          const metaMap = new Map<any, any>()
          for (const key of metaKeys) {
            metaMap.set(key, Reflect.getOwnMetadata(key, this[name]))
          }
          const originMethod = this[name]
          this[name] = (...args) => {
            if (cluster.worker?.id === 1 || isMainCluster) {
              originMethod.call(this, ...args)
            }
          }
          for (const metaKey of metaKeys) {
            Reflect.defineMetadata(metaKey, metaMap.get(metaKey), this[name])
          }
        })
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'backupDB' })
  @CronDescription('备份 DB 并上传 COS')
  async backupDB({ uploadCOS = true }: { uploadCOS?: boolean } = {}) {
    const backup = await this.backupService.backup()
    if (!backup) {
      this.logger.log('没有开启备份')
      return
    }
    //  开始上传 COS
    process.nextTick(async () => {
      if (!uploadCOS) {
        return
      }
      const { backupOptions } = await this.configs.waitForConfigReady()

      if (
        !backupOptions.bucket ||
        !backupOptions.region ||
        !backupOptions.secretId ||
        !backupOptions.secretKey
      ) {
        return
      }
      const backupFilePath = backup.path

      if (!existsSync(backupFilePath)) {
        this.logger.warn('文件不存在, 无法上传到 COS')
        return
      }
      this.logger.log('--> 开始上传到 COS')
      const cos = new COS({
        SecretId: backupOptions.secretId,
        SecretKey: backupOptions.secretKey,
      })
      // 分片上传
      cos.sliceUploadFile(
        {
          Bucket: backupOptions.bucket,
          Region: backupOptions.region,
          Key: backup.path.slice(backup.path.lastIndexOf('/') + 1),
          FilePath: backupFilePath,
        },
        (err) => {
          if (!err) {
            this.logger.log('--> 上传成功')
          } else {
            this.logger.error('--> 上传失败了')
            throw err
          }
        },
      )
    })
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
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
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'resetIPAccess' })
  @CronDescription('清理 IP 访问记录')
  async resetIPAccess() {
    await this.cacheService.getClient().del(getRedisKey(RedisKeys.AccessIp))

    this.logger.log('--> 清理 IP 访问记录成功')
  }

  /**
   * @description 每天凌晨删除缓存
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
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

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'cleanTempDirectory' })
  @CronDescription('清理临时文件')
  async cleanTempDirectory() {
    await rm(TEMP_DIR, { recursive: true })
    mkdirp.sync(TEMP_DIR)
    this.logger.log('--> 清理临时文件成功')
  }
  // “At 00:05.”
  @Cron('5 0 * * *', { name: 'cleanTempDirectory' })
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

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'pushToBaiduSearch' })
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
        this.logger.log(`百度站长提交结果: ${JSON.stringify(res.data)}`)
        return res.data
      } catch (e) {
        this.logger.error(`百度推送错误: ${e.message}`)
        throw e
      }
    }
    return null
  }

  /**
   * @description 每天凌晨推送一遍 Algolia Search
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'pushToAlgoliaSearch' })
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
      Logger.error('algolia推送错误', 'AlgoliaSearch')
      throw err
    }
  }
}

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import algoliasearch from 'algoliasearch'
import COS from 'cos-nodejs-sdk-v5'
import dayjs from 'dayjs'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import mkdirp from 'mkdirp'
import { InjectModel } from 'nestjs-typegoose'
import { join } from 'path'
import { $, cd } from 'zx'
import { MONGO_DB } from '~/app.config'
import { RedisItems, RedisKeys } from '~/constants/cache.constant'
import {
  BACKUP_DIR,
  LOCAL_BOT_LIST_DATA_FILE_PATH,
  TEMP_DIR,
} from '~/constants/path.constant'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { AnalyzeModel } from '~/modules/analyze/analyze.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { NoteService } from '~/modules/note/note.service'
import { PageService } from '~/modules/page/page.service'
import { PostService } from '~/modules/post/post.service'
import { isDev } from '~/utils/index.util'
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
  ) {
    this.logger = new Logger(CronService.name)
  }
  /**
   *
   * @description 每天凌晨更新 Bot 列表
   */
  @Cron(CronExpression.EVERY_WEEK)
  async updateBotList() {
    try {
      const { data: json } = await this.http.axiosRef.get(
        'https://cdn.jsdelivr.net/gh/atmire/COUNTER-Robots@master/COUNTER_Robots_list.json',
      )

      writeFileSync(LOCAL_BOT_LIST_DATA_FILE_PATH, JSON.stringify(json), {
        encoding: 'utf-8',
        flag: 'w+',
      })

      return json
    } catch {
      this.logger.warn('更新 Bot 列表错误')
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'backup' })
  async backupDB({ uploadCOS = true }: { uploadCOS?: boolean } = {}) {
    if (!this.configs.get('backupOptions').enable) {
      return
    }
    this.logger.log('--> 备份数据库中')

    const dateDir = this.nowStr

    const backupDirPath = join(BACKUP_DIR, dateDir)
    mkdirp.sync(backupDirPath)
    try {
      await $`mongodump -h 127.0.0.1 -d ${MONGO_DB.collectionName} -o ${backupDirPath} >/dev/null 2>&1`
      cd(backupDirPath)
      await $`zip -r backup-${dateDir}  mx-space/* && rm -r mx-space`

      this.logger.log('--> 备份成功')
    } catch (e) {
      if (isDev) {
        console.log(e)
      }
      this.logger.error(
        '--> 备份失败, 请确保已安装 zip 或 mongo-tools, mongo-tools 的版本需要与 mongod 版本一致',
      )
      return
    }

    //  开始上传 COS
    process.nextTick(() => {
      if (!uploadCOS) {
        return
      }
      const backupOptions = this.configs.get('backupOptions')
      if (
        !backupOptions.Bucket ||
        !backupOptions.Region ||
        !backupOptions.SecretId ||
        !backupOptions.SecretKey
      ) {
        return
      }
      const backupFilePath = join(backupDirPath, 'backup-' + dateDir + '.zip')

      if (!existsSync(backupFilePath)) {
        this.logger.warn('文件不存在, 无法上传到 COS')
        return
      }
      this.logger.log('--> 开始上传到 COS')
      const cos = new COS({
        SecretId: backupOptions.SecretId,
        SecretKey: backupOptions.SecretKey,
      })
      // 分片上传
      cos.sliceUploadFile(
        {
          Bucket: backupOptions.Bucket,
          Region: backupOptions.Region,
          Key: `backup-${dateDir}.zip`,
          FilePath: backupFilePath,
        },
        (err) => {
          if (!err) {
            this.logger.log('--> 上传成功')
          } else {
            this.logger.error('--> 上传失败了' + err)
          }
        },
      )
    })

    return readFileSync(join(backupDirPath, 'backup-' + dateDir + '.zip'))
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'clear_access',
  })
  async cleanAccessRecord() {
    const now = new Date().getTime()
    const cleanDate = new Date(now - 7 * 60 * 60 * 24 * 1000)

    await this.analyzeModel.deleteMany({
      created: {
        $lte: cleanDate,
      },
    })

    this.logger.log('--> 清理访问记录成功')
  }
  /**
   * @description 每天凌晨删除缓存
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'reset_ua' })
  async resetIPAccess() {
    await this.cacheService
      .getClient()
      .del(getRedisKey(RedisKeys.Access, RedisItems.Ips))

    this.logger.log('--> 清理 IP 访问记录成功')
  }

  /**
   * @description 每天凌晨删除缓存
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'reset_like_article' })
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

    this.logger.log('--> 清理 API 缓存成功')
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  cleanTempDirectory() {
    rmSync(TEMP_DIR, { recursive: true })
    mkdirp.sync(TEMP_DIR)
    this.logger.log('--> 清理临时文件成功')
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pushToBaiduSearch() {
    const configs = this.configs.get('baiduSearchOptions')
    if (configs.enable) {
      const token = configs.token
      if (!token) {
        this.logger.error('[BaiduSearchPushTask] token 为空')
        return
      }
      const siteUrl = this.configs.get('url').webUrl

      const pushUrls = await this.aggregateService.getSiteMapContent()
      const urls = pushUrls
        .map((item) => {
          return item.url
        })
        .join('\n')

      try {
        const res = await this.http.axiosRef.post(
          `http://data.zz.baidu.com/urls?site=${siteUrl}&token=${token}`,
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
        this.logger.error('百度推送错误: ' + e.message)
      }
    }
    return null
  }

  /**
   * @description 每天凌晨推送一遍 algoliasearch
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async pushToAlgoliaSearch() {
    const configs = this.configs.get('algoliaSearchOptions')
    if (configs.enable) {
      this.logger.log('--> 开始推送到 Algolia')
      const client = algoliasearch(configs.appId, configs.apiKey)
      const index = client.initIndex(configs.indexName)
      const documents: Record<'title' | 'text' | 'type' | 'id', string>[] = []
      const combineDocuments = await Promise.all([
        this.postService.model
          .find({ hide: false }, 'title text')
          .lean()
          .then((list) => {
            return list.map((data) => {
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
        await index.saveObjects(documents, {
          autoGenerateObjectIDIfNotExist: true,
        })
        this.logger.log('--> 推送到 algoliasearch 成功')
      } catch {
        Logger.error('algolia推送错误', 'AlgoliaSearch')
      }
    }
  }

  private get nowStr() {
    return dayjs().format('YYYY-MM-DD-HH:mm:ss')
  }
}

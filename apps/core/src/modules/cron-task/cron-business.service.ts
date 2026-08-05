import { rm } from 'node:fs/promises'

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import dayjs from 'dayjs'
import { mkdirp } from 'mkdirp'

import { RedisKeys } from '~/constants/cache.constant'
import { STATIC_FILE_TRASH_DIR, TEMP_DIR } from '~/constants/path.constant'
import { AggregateService } from '~/modules/aggregate/aggregate.service'
import { AnalyzeRepository } from '~/modules/analyze/analyze.repository'
import { ConfigsService } from '~/modules/configs/configs.service'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { SearchService } from '~/modules/search/search.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import type { StoreJWTPayload } from '~/processors/helper/helper.jwt.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getRedisKey } from '~/utils/redis.util'

/**
 * CronBusinessService - Business logic layer for cron tasks.
 *
 * This service only holds business method implementations invoked by
 * CronTaskService. Scheduling logic lives in CronTaskScheduler.
 */
@Injectable()
export class CronBusinessService {
  private logger: Logger
  constructor(
    private readonly http: HttpService,
    private readonly configs: ConfigsService,
    private readonly analyzeRepository: AnalyzeRepository,
    private readonly redisService: RedisService,

    @Inject(forwardRef(() => AggregateService))
    private readonly aggregateService: AggregateService,

    private readonly searchService: SearchService,
    private readonly fileReferenceService: FileReferenceService,
  ) {
    this.logger = new Logger(CronBusinessService.name)
  }

  /**
   * Clean up access records older than 7 days.
   */
  async cleanAccessRecord() {
    const cleanDate = dayjs().add(-7, 'd')

    const deletedCount = await this.analyzeRepository.deleteOlderThan(
      cleanDate.toDate(),
    )

    this.logger.log('--> Access records cleaned up successfully')
    return { deletedCount }
  }

  /**
   * Reset the IP access cache every midnight.
   */
  async resetIPAccess() {
    await this.redisService.getClient().del(getRedisKey(RedisKeys.AccessIp))

    this.logger.log('--> IP access records cleaned up successfully')
    return { success: true }
  }

  /**
   * Reset the like / read article cache every midnight.
   */
  async resetLikedOrReadArticleRecord() {
    const redis = this.redisService.getClient()

    const allKeys = (
      await Promise.all([
        this.redisService.scanKeys(getRedisKey(RedisKeys.Like, '*')),
        this.redisService.scanKeys(getRedisKey(RedisKeys.Read, '*')),
      ])
    ).flat()
    await Promise.all(allKeys.map((key) => redis.del(key)))

    this.logger.log('--> Like counts cleaned up successfully')
    return { success: true }
  }

  /**
   * Clean up the temporary file directory.
   */
  async cleanTempDirectory() {
    await rm(TEMP_DIR, { recursive: true })
    mkdirp.sync(STATIC_FILE_TRASH_DIR)
    this.logger.log('--> Temporary files cleaned up successfully')
    return { success: true }
  }

  /**
   * Push the sitemap to Baidu Search.
   */
  async pushToBaiduSearch() {
    const {
      url: { webUrl },
      baiduSearchOptions: configs,
    } = await this.configs.waitForConfigReady()

    if (!configs.enable) {
      return { skipped: true, reason: 'Baidu search push is disabled' }
    }
    const token = configs.token
    if (!token) {
      this.logger.error('[BaiduSearchPushTask] token is empty')
      return { skipped: true, reason: 'token is empty' }
    }

    const pushUrls = await this.aggregateService.getSiteMapContent()
    const urls = pushUrls.map((item) => item.url).join('\n')

    try {
      const data = await this.http.fetch<any>(
        `http://data.zz.baidu.com/urls?site=${webUrl}&token=${token}`,
        {
          method: 'POST',
          body: urls,
          headers: { 'Content-Type': 'text/plain' },
        },
      )
      this.logger.log(
        `Baidu Webmaster submission result: ${JSON.stringify(data)}`,
      )
      return { response: data }
    } catch (error) {
      this.logger.error(`Baidu push error: ${error.message}`)
      throw error
    }
  }

  /**
   * Push the sitemap to Bing Search.
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
      this.logger.error('[BingSearchPushTask] API key is empty')
      return { skipped: true, reason: 'API key is empty' }
    }

    const pushUrls = await this.aggregateService.getSiteMapContent()
    const urls = pushUrls.map((item) => item.url)

    try {
      const data = await this.http.fetch<any>(
        `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${apiKey}`,
        {
          method: 'POST',
          body: { siteUrl: webUrl, urlList: urls },
          headers: {
            'Content-Type': 'application/json',
            charset: 'utf-8',
          },
        },
      )
      if (data?.d === null) {
        this.logger.log('Bing Webmaster submission succeeded')
      } else {
        this.logger.log(
          `Bing Webmaster submission result: ${JSON.stringify(data)}`,
        )
      }
      return { response: data }
    } catch (error) {
      this.logger.error(`Bing push error: ${error.message}`)
      throw error
    }
  }

  /**
   * Scan the store and delete expired JWTs.
   */
  async deleteExpiredJWT() {
    this.logger.log('--> Scanning the store to purge expired tokens')
    const redis = this.redisService.getClient()
    const storeKey = getRedisKey(RedisKeys.JWTStore)
    const keys = await redis.hkeys(storeKey)
    const results = await Promise.all(
      keys.map(async (key) => {
        const value = await redis.hget(storeKey, key)
        if (!value) return 0
        const parsed = JSON.safeParse(value) as StoreJWTPayload
        if (!parsed) return 0

        const date = dayjs(new Date(parsed.date))
        if (date.add(JWTService.expiresDay, 'd').diff(new Date(), 'd') >= 0) {
          return 0
        }

        this.logger.debug(
          `--> Deleting expired token: ${key}, issued at ${date.format('YYYY-MM-DD H:mm:ss')}`,
        )
        await redis.hdel(storeKey, key)
        return 1
      }),
    )
    const deleteCount = results.reduce((a, b) => a + b, 0)

    this.logger.log(`--> Deleted ${deleteCount} expired tokens`)
    return { deletedCount: deleteCount }
  }

  /**
   * Clean up comment image uploads: a two-pass sweep that removes both
   * pending uploads past TTL and detached uploads past TTL.
   */
  async cleanCommentUploads() {
    this.logger.log('--> Starting cleanup of comment image uploads')
    const result = await this.fileReferenceService.cleanupCommentUploads()
    this.logger.log(
      `--> Comment image upload cleanup finished pending=${result.pendingDeleted} detached=${result.detachedDeleted}`,
    )
    return result
  }

  /**
   * Rebuild the search index (incremental by default; documents whose
   * source_hash is unchanged are skipped).
   */
  async rebuildSearchIndex() {
    this.logger.log('--> Starting search index rebuild (incremental)')
    const result = await this.searchService.rebuildSearchDocuments({
      force: false,
    })
    this.logger.log(
      `--> Search index rebuild finished total=${result.total} created=${result.created} updated=${result.updated} deleted=${result.deleted} skipped=${result.skipped}`,
    )
    return result
  }
}

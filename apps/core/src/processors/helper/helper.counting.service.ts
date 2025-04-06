import type { ArticleTypeEnum } from '~/constants/article.constant'

import { Injectable, Logger } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

import { DatabaseService } from '../database/database.service'
import { RedisService } from '../redis/redis.service'

@Injectable()
export class CountingService {
  private logger: Logger
  constructor(
    private readonly redisService: RedisService,
    private readonly databaseService: DatabaseService,
  ) {
    this.logger = new Logger(CountingService.name)
  }

  private checkIdAndIp(id: string, ip: string) {
    if (!ip) {
      this.logger.debug('无法更新阅读计数，IP 无效')
      return false
    }
    if (!id) {
      this.logger.debug('无法更新阅读计数，ID 不存在')
      return false
    }
    return true
  }

  public async updateLikeCountWithIp(
    type: ArticleTypeEnum,
    id: string,
    ip: string,
  ): Promise<boolean> {
    const redis = this.redisService.getClient()
    const isLikeBefore = await this.getThisRecordIsLiked(id, ip)

    const model = this.databaseService.getModelByRefType(type)
    const doc = await model.findById(id)

    if (!doc) {
      throw '无法更新喜欢计数，文档不存在'
    }

    if (isLikeBefore) {
      this.logger.debug(`已经增加过计数了，${id}`)
      return false
    }
    await Promise.all([
      redis.sadd(getRedisKey(RedisKeys.Like, doc.id), ip),
      doc.updateOne({ $inc: { 'count.like': 1 } }),
    ])
    this.logger.debug(`增加喜欢计数，(${doc.title}`)
    return true
  }

  public async updateReadCount(type: ArticleTypeEnum, id: string) {
    const model = this.databaseService.getModelByRefType(type)
    const doc = await model.findById(id)

    if (!doc) throw ''
    await doc.updateOne({ $inc: { 'count.read': 1 } }).lean()
    this.logger.debug(`增加阅读计数，(${doc.title}`)
    return doc
  }

  async getThisRecordIsLiked(id: string, ip: string) {
    if (!this.checkIdAndIp(id, ip)) {
      throw '无法获取到 IP'
    }

    const redis = this.redisService.getClient()
    const isLikeBefore = await redis.sismember(
      getRedisKey(RedisKeys.Like, id),
      ip,
    )
    return !!isLikeBefore
  }
}

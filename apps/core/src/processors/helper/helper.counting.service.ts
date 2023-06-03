import { Injectable, Logger } from '@nestjs/common'

import { ArticleType } from '~/constants/article.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey } from '~/utils/redis.util'

import { DatabaseService } from '../database/database.service'
import { CacheService } from '../redis/cache.service'

@Injectable()
export class CountingService {
  private logger: Logger
  constructor(
    private readonly redis: CacheService,
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

  public async updateReadCount(
    type: keyof typeof ArticleType,
    id: string,
    ip: string,
  ) {
    if (!this.checkIdAndIp(id, ip)) {
      return
    }

    const model = this.databaseService.getModelByRefType(type as any)
    const doc = await model.findById(id)

    if (!doc) {
      this.logger.debug('无法更新阅读计数，文档不存在')
      return
    }

    const redis = this.redis.getClient()

    const isReadBefore = await redis.sismember(
      getRedisKey(RedisKeys.Read, id),
      ip,
    )
    if (isReadBefore) {
      this.logger.debug(`已经增加过计数了，${id}`)
      return
    }
    await Promise.all([
      redis.sadd(getRedisKey(RedisKeys.Read, doc.id), ip),
      doc.updateOne({ $inc: { 'count.read': 1 } }),
    ])
    this.logger.debug(`增加阅读计数，(${doc.title}`)
  }

  public async updateLikeCount(
    type: keyof typeof ArticleType,
    id: string,
    ip: string,
  ): Promise<boolean> {
    const redis = this.redis.getClient()
    const isLikeBefore = await this.getThisRecordIsLiked(id, ip)

    const model = this.databaseService.getModelByRefType(type as any)
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

  async getThisRecordIsLiked(id: string, ip: string) {
    if (!this.checkIdAndIp(id, ip)) {
      throw '无法获取到 IP'
    }

    const redis = this.redis.getClient()
    const isLikeBefore = await redis.sismember(
      getRedisKey(RedisKeys.Like, id),
      ip,
    )
    return !!isLikeBefore
  }
}

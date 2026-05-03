import { Injectable, Logger } from '@nestjs/common'

import { ArticleTypeEnum } from '~/constants/article.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { NoteRepository } from '~/modules/note/note.repository'
import { PostRepository } from '~/modules/post/post.repository'
import { getRedisKey } from '~/utils/redis.util'

import { RedisService } from '../redis/redis.service'

@Injectable()
export class CountingService {
  private logger: Logger
  constructor(
    private readonly redisService: RedisService,
    private readonly postRepository: PostRepository,
    private readonly noteRepository: NoteRepository,
  ) {
    this.logger = new Logger(CountingService.name)
  }

  private repoFor(type: ArticleTypeEnum) {
    if (type === ArticleTypeEnum.Post) return this.postRepository
    if (type === ArticleTypeEnum.Note) return this.noteRepository
    return null
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

  async updateLikeCountWithIp(
    type: ArticleTypeEnum,
    id: string,
    ip: string,
  ): Promise<boolean> {
    const repo = this.repoFor(type)
    if (!repo) return false
    const doc = await repo.findById(id)
    if (!doc) throw '无法更新喜欢计数，文档不存在'

    const isLikeBefore = await this.getThisRecordIsLiked(id, ip)
    if (isLikeBefore) {
      this.logger.debug(`已经增加过计数了，${id}`)
      return false
    }

    const redis = this.redisService.getClient()
    await Promise.all([
      redis.sadd(getRedisKey(RedisKeys.Like, doc.id), ip),
      repo.incrementLike(doc.id),
    ])
    this.logger.debug(`增加喜欢计数，${doc.title}`)
    return true
  }

  async updateReadCount(type: ArticleTypeEnum, id: string) {
    const repo = this.repoFor(type)
    if (!repo) return null
    const doc = await repo.findById(id)
    if (!doc) throw ''
    await repo.incrementRead(doc.id)
    this.logger.debug(`增加阅读计数，${doc.title}`)
    return { ...doc, readCount: doc.readCount + 1 }
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

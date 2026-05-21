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
      this.logger.debug('Cannot update read count: invalid IP')
      return false
    }
    if (!id) {
      this.logger.debug('Cannot update read count: missing ID')
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
    if (!doc) throw 'Cannot update like count: document not found'

    const isLikeBefore = await this.getThisRecordIsLiked(id, ip)
    if (isLikeBefore) {
      this.logger.debug(`Already counted, ${id}`)
      return false
    }

    const redis = this.redisService.getClient()
    await Promise.all([
      redis.sadd(getRedisKey(RedisKeys.Like, doc.id), ip),
      repo.incrementLike(doc.id),
    ])
    this.logger.debug(`Incremented like count, ${doc.title}`)
    return true
  }

  async updateReadCount(type: ArticleTypeEnum, id: string) {
    const repo = this.repoFor(type)
    if (!repo) return null
    const doc = await repo.findById(id)
    if (!doc) throw ''
    await repo.incrementRead(doc.id)
    this.logger.debug(`Incremented read count, ${doc.title}`)
    return { ...doc, readCount: doc.readCount + 1 }
  }

  async getThisRecordIsLiked(id: string, ip: string) {
    if (!this.checkIdAndIp(id, ip)) {
      throw 'Cannot resolve IP'
    }

    const redis = this.redisService.getClient()
    const isLikeBefore = await redis.sismember(
      getRedisKey(RedisKeys.Like, id),
      ip,
    )
    return !!isLikeBefore
  }
}

/**
 * 处理 Article 类型响应, 增加计数
 * @author Innei
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { InjectModel } from 'nestjs-typegoose'
import { map } from 'rxjs'
import { ArticleType } from '~/constants/article.constant'
import { RedisKeys } from '~/constants/cache.constant'
import { HTTP_RES_UPDATE_DOC_COUNT_TYPE } from '~/constants/meta.constant'
import { NoteModel } from '~/modules/note/note.model'
import { PostModel } from '~/modules/post/post.model'
import { CacheService } from '~/processors/cache/cache.service'
import { getIp } from '~/utils/ip.util'
import { getRedisKey } from '~/utils/redis.util'
// ResponseInterceptor -> JSONSerializeInterceptor -> CountingInterceptor -> HttpCacheInterceptor
@Injectable()
export class CountingInterceptor<T> implements NestInterceptor<T, any> {
  private logger: Logger
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(PostModel)
    private readonly postModel: MongooseModel<PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    private readonly redis: CacheService,
  ) {
    this.logger = new Logger(CountingInterceptor.name)
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    const handler = context.getHandler()
    return next.handle().pipe(
      map((data) => {
        // 计数处理
        const documentType = this.reflector.get(
          HTTP_RES_UPDATE_DOC_COUNT_TYPE,
          handler,
        )
        if (documentType) {
          this.updateReadCount(
            documentType as any,
            data.id || data?.data?.id,
            getIp(context.switchToHttp().getRequest()),
          )
        }

        return data
      }),
    )
  }

  private async updateReadCount(
    type: keyof typeof ArticleType,
    id: string,
    ip: string,
  ) {
    if (!ip) {
      this.logger.debug('无法更新阅读计数, IP 无效')
      return
    }
    if (!id) {
      this.logger.debug('无法更新阅读计数, ID 不存在')
      return
    }
    const modelMap = {
      Post: this.postModel,
      Note: this.noteModel,
    } as const

    const model = modelMap[type]

    const redis = this.redis.getClient()

    const isReadBefore = await redis.sismember(
      getRedisKey(RedisKeys.Read, id),
      ip,
    )
    if (isReadBefore) {
      this.logger.debug('已经增加过计数了, ' + id)
      return
    }
    const doc = await model.findOne({ _id: id })
    await Promise.all([
      redis.sadd(getRedisKey(RedisKeys.Read, doc._id), ip),
      doc.updateOne({ $inc: { 'count.read': 1 } }),
    ])
    this.logger.debug('增加计数, ' + doc.title)
  }
}

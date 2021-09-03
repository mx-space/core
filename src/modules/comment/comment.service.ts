import { Injectable, Logger } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { hasChinese } from '~/utils/index.util'
import { ConfigsService } from '../configs/configs.service'
import { NoteModel } from '../note/note.model'
import { PageModel } from '../page/page.model'
import { PostModel } from '../post/post.model'
import { UserService } from '../user/user.service'
import BlockedKeywords from './block-keywords.json'
import { CommentModel, CommentRefTypes } from './comment.model'
@Injectable()
export class CommentService {
  private readonly logger: Logger = new Logger(CommentService.name)
  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    @InjectModel(PostModel)
    private readonly postModel: ReturnModelType<typeof PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: ReturnModelType<typeof NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: ReturnModelType<typeof PageModel>,
    private readonly configs: ConfigsService,
    private readonly userService: UserService,
  ) {}

  private getModelByRefType(type: CommentRefTypes) {
    const map = new Map(
      Object.entries({
        Post: this.postModel,
        Note: this.noteModel,
        Page: this.pageModel,
      }),
    )
    return map.get(type) as any as ReturnModelType<
      typeof NoteModel | typeof PostModel | typeof PageModel
    >
  }

  async checkSpam(doc: Partial<CommentModel>) {
    const res = await (async () => {
      const commentOptions = this.configs.get('commentOptions')
      if (!commentOptions.antiSpam) {
        return false
      }
      const master = await this.userService.getMaster()
      if (doc.author === master.username) {
        return false
      }
      if (commentOptions.blockIps) {
        const isBlock = commentOptions.blockIps.some((ip) =>
          new RegExp(ip, 'ig').test(doc.ip),
        )
        if (isBlock) {
          return true
        }
      }

      const customKeywords = commentOptions.spamKeywords || []
      const isBlock = [...customKeywords, ...BlockedKeywords].some((keyword) =>
        new RegExp(keyword, 'ig').test(doc.text),
      )

      if (isBlock) {
        return true
      }

      if (commentOptions.disableNoChinese && !hasChinese(doc.text)) {
        return true
      }

      return false
    })()
    if (res) {
      this.logger.warn(
        '--> 检测到一条垃圾评论: ' +
          `作者: ${doc.author}, IP: ${doc.ip}, 内容为: ${doc.text}`,
      )
    }
    return res
  }
}

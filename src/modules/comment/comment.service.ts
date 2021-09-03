import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { DocumentType, ReturnModelType } from '@typegoose/typegoose'
import { Types } from 'mongoose'
import { InjectModel } from 'nestjs-typegoose'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import {
  EmailService,
  ReplyMailType,
} from '~/processors/helper/helper.email.service'
import { hasChinese, isDev } from '~/utils/index.util'
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
    private readonly mailService: EmailService,
  ) {}

  public get model() {
    return this.commentModel
  }

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

  async createComment(
    id: string,
    type: CommentRefTypes,
    doc: Partial<CommentModel>,
  ) {
    const model = this.getModelByRefType(type)
    const ref = await model.findById(id)
    if (!ref) {
      throw new CannotFindException()
    }
    const commentIndex = ref.commentsIndex
    doc.key = `#${commentIndex + 1}`
    const comment = await this.commentModel.create({
      ...doc,
      ref: Types.ObjectId(id),
      refType: type,
    })
    await ref.updateOne({
      $inc: {
        commentsIndex: 1,
      },
    })

    return comment
  }

  async ValidAuthorName(author: string): Promise<void> {
    const isExist = await this.userService.model.findOne({
      name: author,
    })
    if (isExist) {
      throw new BadRequestException(
        '用户名与主人重名啦, 但是你好像并不是我的主人唉',
      )
    }
  }

  async deleteComments(id: string) {
    const comment = await this.commentModel.findOneAndDelete({ _id: id })
    if (!comment) {
      throw new CannotFindException()
    }
    const { children, parent } = comment
    if (children && children.length > 0) {
      await Promise.all(
        children.map(async (id) => {
          await this.deleteComments(id as any as string)
        }),
      )
    }
    if (parent) {
      const parent = await this.commentModel.findById(comment.parent)
      if (parent) {
        await parent.updateOne({
          $pull: {
            children: comment._id,
          },
        })
      }
    }
    return { message: '删除成功' }
  }

  async allowComment(id: string, type: CommentRefTypes) {
    const model = this.getModelByRefType(type)
    const doc = await model.findById(id)
    return doc.allowComment ?? true
  }

  async getComments({ page, size, state } = { page: 1, size: 10, state: 0 }) {
    const queryList = await this.commentModel.paginate(
      { state },
      {
        select: '+ip +agent -children',
        page,
        limit: size,
        populate: [
          { path: 'parent', select: '-children' },
          { path: 'ref', select: 'title _id slug nid' },
        ],
        sort: { created: -1 },
      },
    )

    return queryList
  }

  async sendEmail(
    model: DocumentType<CommentModel>,
    type: ReplyMailType,
    debug?: true,
  ) {
    const enable = this.configs.get('mailOptions').enable
    if (!enable || (isDev && !debug)) {
      return
    }

    this.userService.model.findOne().then(async (master) => {
      const refType = model.refType
      const refModel = this.getModelByRefType(refType)
      const ref = await refModel.findById(model.ref).populate('category')
      const time = new Date(model.created)
      const parent = await this.commentModel.findOne({ _id: model.parent })

      const parsedTime = `${time.getDate()}/${
        time.getMonth() + 1
      }/${time.getFullYear()}`

      this.mailService.sendCommentNotificationMail({
        to: type === ReplyMailType.Owner ? master.mail : parent.mail,
        type,
        source: {
          title: ref.title,
          text: model.text,
          author: type === ReplyMailType.Guest ? parent.author : model.author,
          master: master.name,
          link: this.resolveUrlByType(refType, ref),
          time: parsedTime,
          mail: ReplyMailType.Owner === type ? model.mail : master.mail,
          ip: model.ip || '',
        },
      })
    })
  }

  resolveUrlByType(type: CommentRefTypes, model: any) {
    const base = this.configs.get('url').webUrl
    switch (type) {
      case CommentRefTypes.Note: {
        return new URL('/notes/' + model.nid, base).toString()
      }
      case CommentRefTypes.Page: {
        return new URL(`/${model.slug}`, base).toString()
      }
      case CommentRefTypes.Post: {
        return new URL(`/${model.category.slug}/${model.slug}`, base).toString()
      }
    }
  }
}

import { LeanDocument, Types } from 'mongoose'
import { URL } from 'url'

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common'
import { DocumentType } from '@typegoose/typegoose'
import { BeAnObject, ReturnModelType } from '@typegoose/typegoose/lib/types'

import { BusinessException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import {
  EmailService,
  ReplyMailType,
} from '~/processors/helper/helper.email.service'
import { WriteBaseModel } from '~/shared/model/write-base.model'
import { InjectModel } from '~/transformers/model.transformer'
import { hasChinese } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetModel, SnippetType } from '../snippet/snippet.model'
import { UserService } from '../user/user.service'
import BlockedKeywords from './block-keywords.json'
import { CommentModel, CommentRefTypes, CommentState } from './comment.model'

@Injectable()
export class CommentService {
  private readonly logger: Logger = new Logger(CommentService.name)
  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    private readonly databaseService: DatabaseService,
    private readonly configs: ConfigsService,
    private readonly userService: UserService,
    private readonly mailService: EmailService,

    private readonly configsService: ConfigsService,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
  ) {}

  public get model() {
    return this.commentModel
  }

  private getModelByRefType(
    type: CommentRefTypes,
  ): ReturnModelType<typeof WriteBaseModel> {
    switch (type) {
      case CommentRefTypes.Note:
        return this.databaseService.getModelByRefType('Note') as any
      case CommentRefTypes.Page:
        return this.databaseService.getModelByRefType('Page') as any
      case CommentRefTypes.Post:
        return this.databaseService.getModelByRefType('Post') as any
      case CommentRefTypes.Recently:
        return this.databaseService.getModelByRefType('Recently') as any
    }
  }

  async checkSpam(doc: CommentModel) {
    const res = await (async () => {
      const commentOptions = await this.configs.get('commentOptions')
      if (!commentOptions.antiSpam) {
        return false
      }
      const master = await this.userService.getMaster()
      if (doc.author === master.username) {
        return false
      }
      if (commentOptions.blockIps) {
        if (!doc.ip) {
          return false
        }
        const isBlock = commentOptions.blockIps.some((ip) =>
          // @ts-ignore
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
        '--> 检测到一条垃圾评论：' +
          `作者：${doc.author}, IP: ${doc.ip}, 内容为：${doc.text}`,
      )
    }
    return res
  }

  async createComment(
    id: string,
    doc: Partial<CommentModel>,
    type?: CommentRefTypes,
  ) {
    let ref: LeanDocument<DocumentType<WriteBaseModel, BeAnObject>>
    if (type) {
      const model = this.getModelByRefType(type)

      ref = await model.findById(id).lean()
    } else {
      const { type: type_, document } =
        await this.databaseService.findGlobalById(id)
      ref = document as any
      type = type_ as any
    }
    if (!ref) {
      throw new NotFoundException('评论文章不存在')
    }
    const commentIndex = ref.commentsIndex || 0
    doc.key = `#${commentIndex + 1}`
    const comment = await this.commentModel.create({
      ...doc,
      state: CommentState.Unread,
      ref: new Types.ObjectId(id),
      refType: type,
    })

    await this.databaseService.getModelByRefType(type as any).updateOne(
      { _id: ref._id },
      {
        $inc: {
          commentsIndex: 1,
        },
      },
    )

    return comment
  }

  async validAuthorName(author: string): Promise<void> {
    const isExist = await this.userService.model.findOne({
      name: author,
    })
    if (isExist) {
      throw new BadRequestException(
        '用户名与主人重名啦，但是你好像并不是我的主人唉',
      )
    }
  }

  async deleteComments(id: string) {
    const comment = await this.commentModel.findOneAndDelete({ _id: id })
    if (!comment) {
      throw new NoContentCanBeModifiedException()
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
  }

  async allowComment(id: string, type?: CommentRefTypes) {
    if (type) {
      const model = this.getModelByRefType(type)
      const doc = await model.findById(id)
      if (!doc) {
        throw new CannotFindException()
      }
      return doc.allowComment ?? true
    } else {
      const { document: doc } = await this.databaseService.findGlobalById(id)
      if (!doc) {
        throw new CannotFindException()
      }
      return doc.allowComment ?? true
    }
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
          {
            path: 'ref',
            // categoryId for post
            // content for recently
            select: 'title _id slug nid categoryId content',
          },
        ],
        sort: { created: -1 },
      },
    )

    await this.replaceMasterAvatarUrl(queryList.docs)

    return queryList
  }

  async sendEmail(model: DocumentType<CommentModel>, type: ReplyMailType) {
    const enable = (await this.configs.get('mailOptions')).enable
    if (!enable) {
      return
    }

    this.userService.model.findOne().then(async (master) => {
      if (!master) {
        throw new BusinessException(ErrorCodeEnum.MasterLost)
      }

      const refType = model.refType
      const refModel = this.getModelByRefType(refType)
      const refDoc = await refModel.findById(model.ref).lean()
      const time = new Date(model.created!)
      const parent = await this.commentModel
        .findOne({ _id: model.parent })
        .lean()

      const parsedTime = `${time.getDate()}/${
        time.getMonth() + 1
      }/${time.getFullYear()}`

      if (!refDoc || !master.mail) {
        return
      }

      this.mailService.sendCommentNotificationMail({
        to: type === ReplyMailType.Owner ? master.mail : parent!.mail,
        type,
        source: {
          title: refDoc.title,
          text: model.text,
          author: type === ReplyMailType.Guest ? parent!.author : model.author,
          master: master.name,
          link: await this.resolveUrlByType(refType, refDoc),
          time: parsedTime,
          mail: ReplyMailType.Owner === type ? model.mail : master.mail,
          ip: model.ip || '',
        },
      })
    })
  }

  async resolveUrlByType(type: CommentRefTypes, model: any) {
    const {
      url: { webUrl: base },
    } = await this.configs.waitForConfigReady()
    switch (type) {
      case CommentRefTypes.Note: {
        return new URL(`/notes/${model.nid}`, base).toString()
      }
      case CommentRefTypes.Page: {
        return new URL(`/${model.slug}`, base).toString()
      }
      case CommentRefTypes.Post: {
        return new URL(`/${model.category.slug}/${model.slug}`, base).toString()
      }
      case CommentRefTypes.Recently: {
        return new URL(`/recently/${model._id}`, base).toString()
      }
    }
  }

  async appendIpLocation(id: string, ip: string) {
    if (!ip) {
      return
    }
    const { recordIpLocation } = await this.configsService.get('commentOptions')

    if (!recordIpLocation) {
      return
    }

    const model = this.commentModel.findById(id).lean()
    if (!model) {
      return
    }

    const fnModel = (await this.serverlessService.model
      .findOne({
        name: 'ip',
        reference: 'built-in',
        type: SnippetType.Function,
      })
      .select('+secret')
      .lean({
        getters: true,
      })) as SnippetModel

    if (!fnModel) {
      this.logger.error('[Serverless Fn] ip query function is missing.')
      return model
    }

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        fnModel,
        {
          req: {
            query: { ip },
          },
          res: createMockedContextResponse({} as any),
        } as any,
      )

    const location =
      `${result.countryName || ''}${
        result.regionName && result.regionName !== result.cityName
          ? `${result.regionName}`
          : ''
      }${result.cityName ? `${result.cityName}` : ''}` || undefined

    if (location) await this.commentModel.updateOne({ _id: id }, { location })
  }

  async replaceMasterAvatarUrl(comments: CommentModel[]) {
    const master = await this.userService.getMaster()

    comments.forEach(function process(comment) {
      if (typeof comment == 'string') {
        return
      }
      if (comment.author === master.name) {
        comment.avatar = master.avatar || comment.avatar
      }
      if (comment.children?.length) {
        comment.children.forEach((child) => {
          process(child as CommentModel)
        })
      }

      return comment
    })
  }
}

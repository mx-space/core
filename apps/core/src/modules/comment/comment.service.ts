/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { URL } from 'url'
import { render } from 'ejs'
import { omit, pick } from 'lodash'
import { Types } from 'mongoose'
import type { OnModuleInit } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose/lib/types'
import type { WriteBaseModel } from '~/shared/model/write-base.model'
import type { SnippetModel } from '../snippet/snippet.model'
import type {
  CommentEmailTemplateRenderProps,
  CommentModelRenderProps,
} from './comment.email.default'

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { DatabaseService } from '~/processors/database/database.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import { InjectModel } from '~/transformers/model.transformer'
import { hasChinese } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import { SnippetType } from '../snippet/snippet.model'
import { UserModel } from '../user/user.model'
import { UserService } from '../user/user.service'
import BlockedKeywords from './block-keywords.json'
import {
  baseRenderProps,
  defaultCommentModelKeys,
} from './comment.email.default'
import { CommentReplyMailType } from './comment.enum'
import { CommentModel, CommentRefTypes, CommentState } from './comment.model'

@Injectable()
export class CommentService implements OnModuleInit {
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

  private async getMailOwnerProps() {
    const masterInfo = await this.userService.getSiteMasterOrMocked()
    return UserModel.serialize(masterInfo)
  }
  async onModuleInit() {
    const masterInfo = await this.getMailOwnerProps()
    const renderProps = {
      ...baseRenderProps,

      master: masterInfo.name,

      aggregate: {
        ...baseRenderProps.aggregate,
        owner: omit(masterInfo, [
          'password',
          'apiToken',
          'lastLoginIp',
          'lastLoginTime',
          'oauth2',
        ] as (keyof UserModel)[]),
      },
    }
    this.mailService.registerEmailType(CommentReplyMailType.Guest, {
      ...renderProps,
    })
    this.mailService.registerEmailType(CommentReplyMailType.Owner, {
      ...renderProps,
    })
  }
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
    let ref: (WriteBaseModel & { _id: any }) | null = null
    if (type) {
      const model = this.getModelByRefType(type)

      ref = await model.findById(id).lean()
    } else {
      const result = await this.databaseService.findGlobalById(id)
      if (result) {
        const { type: type_, document } = result
        ref = document as any
        type = type_ as any
      }
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
      const result = await this.databaseService.findGlobalById(id)
      if (!result) {
        throw new CannotFindException()
      }
      return 'allowComment' in result ? result.allowComment : true
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
        autopopulate: false,
      },
    )

    // 过滤脏数据
    this.cleanDirtyData(queryList.docs)

    await this.replaceMasterAvatarUrl(queryList.docs)

    return queryList
  }

  cleanDirtyData(docs: CommentModel[]) {
    for (const doc of docs) {
      if (!doc.children || doc.children.length === 0) {
        continue
      }

      const nextChildren = [] as any[]

      for (const child of doc.children) {
        if (typeof child === 'string') {
          this.logger.warn(`--> 检测到一条脏数据：${doc.id}.child: ${child}`)
          continue
        }
        nextChildren.push(child)

        if ((child as CommentModel).children) {
          this.cleanDirtyData((child as CommentModel).children as any[])
        }
      }

      doc.children = nextChildren
    }
  }

  async sendEmail(model: CommentModel, type: CommentReplyMailType) {
    const enable = await this.configs
      .get('mailOptions')
      .then((config) => config.enable)
    if (!enable) {
      return
    }

    const masterInfo = await this.userService.getMasterInfo()

    const refType = model.refType
    const refModel = this.getModelByRefType(refType)
    const refDoc = await refModel.findById(model.ref).lean()
    const time = new Date(model.created!)
    const parent = await this.commentModel.findOne({ _id: model.parent }).lean()

    const parsedTime = `${time.getDate()}/${
      time.getMonth() + 1
    }/${time.getFullYear()}`

    if (!refDoc || !masterInfo.mail) {
      return
    }

    this.sendCommentNotificationMail({
      to: type === CommentReplyMailType.Owner ? masterInfo.mail : parent!.mail,
      type,
      source: {
        title: refDoc.title,
        text: model.text,
        author:
          type === CommentReplyMailType.Guest ? parent!.author : model.author,
        master: masterInfo.name,
        link: await this.resolveUrlByType(refType, refDoc),
        time: parsedTime,
        mail:
          CommentReplyMailType.Owner === type ? model.mail : masterInfo.mail,
        ip: model.ip || '',

        aggregate: {
          owner: masterInfo,
          commentor: {
            ...pick(model, defaultCommentModelKeys),
            created: new Date(model.created!).toISOString(),
            isWhispers: model.isWhispers || false,
          } as CommentModelRenderProps,
          post: {
            title: refDoc.title,
            created: new Date(refDoc.created!).toISOString(),
            id: refDoc.id!,
            modified: new Date(refDoc.modified!).toISOString(),
            text: refDoc.text,
          },
        },
      },
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

  async sendCommentNotificationMail({
    to,
    source,
    type,
  }: {
    to: string
    source: Pick<
      CommentEmailTemplateRenderProps,
      keyof CommentEmailTemplateRenderProps
    >
    type: CommentReplyMailType
  }) {
    const { seo, mailOptions } = await this.configsService.waitForConfigReady()
    const { user } = mailOptions
    const from = `"${seo.title || 'Mx Space'}" <${user}>`

    source.ip ??= ''
    if (type === CommentReplyMailType.Guest) {
      const options = {
        from,
        ...{
          subject: `[${seo.title || 'Mx Space'}] 主人给你了新的回复呐`,
          to,
          html: render(
            (await this.mailService.readTemplate(type)) as string,
            source,
          ),
        },
      }
      if (isDev) {
        // @ts-ignore
        delete options.html
        Object.assign(options, { source })
        this.logger.log(options)
        return
      }
      await this.mailService.send(options)
    } else {
      const options = {
        from,
        ...{
          subject: `[${seo.title || 'Mx Space'}] 有新回复了耶~`,
          to,
          html: render(
            (await this.mailService.readTemplate(type)) as string,
            source,
          ),
        },
      }
      if (isDev) {
        // @ts-ignore
        delete options.html
        Object.assign(options, { source })
        this.logger.log(options)
        return
      }
      await this.mailService.send(options)
    }
  }
}

import { URL } from 'node:url'
import { render } from 'ejs'
import { omit, pick } from 'lodash'
import { Types, isObjectIdOrHexString } from 'mongoose'

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getAvatar, hasChinese, scheduleManager } from '~/utils'

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
import { CommentModel, CommentState } from './comment.model'
import type {
  CommentEmailTemplateRenderProps,
  CommentModelRenderProps,
} from './comment.email.default'
import type { SnippetModel } from '../snippet/snippet.model'
import type { WriteBaseModel } from '~/shared/model/write-base.model'
import type { OnModuleInit } from '@nestjs/common'
import type { ReturnModelType } from '@typegoose/typegoose/lib/types'

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
    private readonly eventManager: EventManagerService,
    private readonly barkService: BarkPushService,
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
    type: CollectionRefTypes,
  ): ReturnModelType<typeof WriteBaseModel> {
    return this.databaseService.getModelByRefType(type) as any
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
    type?: CollectionRefTypes,
  ) {
    let ref: (WriteBaseModel & { _id: any }) | null = null
    let refType = type
    if (type) {
      const model = this.getModelByRefType(type)

      ref = await model.findById(id).lean()
    } else {
      const result = await this.databaseService.findGlobalById(id)
      if (result) {
        const { type, document } = result
        ref = document as any
        refType = type
      }
    }
    if (!ref) {
      throw new BadRequestException('评论文章不存在')
    }
    const commentIndex = ref.commentsIndex || 0
    doc.key = `#${commentIndex + 1}`

    const comment = await this.commentModel.create({
      ...doc,
      state: CommentState.Unread,
      ref: new Types.ObjectId(id),
      refType,
    })

    await this.databaseService.getModelByRefType(refType!).updateOne(
      { _id: ref._id },
      {
        $inc: {
          commentsIndex: 1,
        },
      },
    )

    return comment
  }

  async afterCreateComment(
    commentId: string,
    ipLocation: { ip: string },
    isAuthenticated: boolean,
  ) {
    const comment = await this.commentModel
      .findById(commentId)
      .lean({
        getters: true,
      })
      .select('+ip +agent')

    if (!comment) return
    scheduleManager.schedule(async () => {
      if (isAuthenticated) {
        return
      }
      await this.appendIpLocation(commentId, ipLocation.ip)
    })

    scheduleManager.batch(async () => {
      const configs = await this.configsService.get('commentOptions')
      const { commentShouldAudit } = configs
      if (await this.checkSpam(comment)) {
        await this.commentModel.updateOne(
          { _id: commentId },
          {
            state: CommentState.Junk,
          },
        )

        return
      } else if (!isAuthenticated) {
        this.sendEmail(comment, CommentReplyMailType.Owner)
      }

      await this.eventManager.broadcast(
        BusinessEvents.COMMENT_CREATE,
        comment,
        {
          scope: EventScope.TO_SYSTEM_ADMIN,
        },
      )

      if (commentShouldAudit || comment.isWhispers) {
        /* empty */
      } else {
        await this.eventManager.broadcast(
          BusinessEvents.COMMENT_CREATE,
          omit(comment, ['ip', 'agent']),
          {
            scope: EventScope.TO_VISITOR,
          },
        )
      }
    })
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
    const comment = await this.commentModel.findById(id).lean()
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
    await this.commentModel.deleteOne({ _id: id })
  }

  async allowComment(id: string, type?: CollectionRefTypes) {
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

    await this.fillAndReplaceAvatarUrl(queryList.docs)

    return queryList
  }

  cleanDirtyData(docs: CommentModel[]) {
    for (const doc of docs) {
      if (!doc.children || doc.children.length === 0) {
        continue
      }

      const nextChildren = [] as any[]

      for (const child of doc.children) {
        if (isObjectIdOrHexString(child)) {
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

  async sendEmail(comment: CommentModel, type: CommentReplyMailType) {
    const enable = await this.configs
      .get('mailOptions')
      .then((config) => config.enable)
    if (!enable) {
      return
    }

    const masterInfo = await this.userService.getMasterInfo()

    const refType = comment.refType
    const refModel = this.getModelByRefType(refType)
    const refDoc = await refModel.findById(comment.ref)
    const time = new Date(comment.created!)
    const parent: CommentModel | null = await this.commentModel
      .findOne({ _id: comment.parent })
      .lean()

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
        title: refType === CollectionRefTypes.Recently ? '速记' : refDoc.title,
        text: comment.text,
        author:
          type === CommentReplyMailType.Guest ? parent!.author : comment.author,
        master: masterInfo.name,
        link: await this.resolveUrlByType(refType, refDoc).then(
          (url) => `${url}#comments-${comment.id}`,
        ),
        time: parsedTime,
        mail:
          CommentReplyMailType.Owner === type ? comment.mail : masterInfo.mail,
        ip: comment.ip || '',

        aggregate: {
          owner: masterInfo,
          commentor: {
            ...pick(comment, defaultCommentModelKeys),
            created: new Date(comment.created!).toISOString(),
            isWhispers: comment.isWhispers || false,
          } as CommentModelRenderProps,
          parent,
          post: {
            title: refDoc.title,
            created: new Date(refDoc.created!).toISOString(),
            id: refDoc.id!,
            modified: refDoc.modified
              ? new Date(refDoc.modified!).toISOString()
              : null,
            text: refDoc.text,
          },
        },
      },
    })
  }

  async resolveUrlByType(type: CollectionRefTypes, model: any) {
    const {
      url: { webUrl: base },
    } = await this.configs.waitForConfigReady()
    switch (type) {
      case CollectionRefTypes.Note: {
        return new URL(`/notes/${model.nid}`, base).toString()
      }
      case CollectionRefTypes.Page: {
        return new URL(`/${model.slug}`, base).toString()
      }
      case CollectionRefTypes.Post: {
        return new URL(
          `/posts/${model.category.slug}/${model.slug}`,
          base,
        ).toString()
      }
      case CollectionRefTypes.Recently: {
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

  async fillAndReplaceAvatarUrl(comments: CommentModel[]) {
    const master = await this.userService.getMaster()

    comments.forEach(function process(comment) {
      if (typeof comment == 'string') {
        return
      }
      // 如果是 author 是站长，就用站长自己设定的头像替换
      if (comment.author === master.name) {
        comment.avatar = master.avatar || comment.avatar
      }

      // 如果不存在头像就
      if (!comment.avatar) {
        comment.avatar = getAvatar(comment.mail)
      }

      if (comment.children?.length) {
        comment.children.forEach((child) => {
          process(child as CommentModel)
        })
      }

      return comment
    })

    return comments
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
        subject: `[${seo.title || 'Mx Space'}] 主人给你了新的回复呐`,
        to,
        html: render(
          (await this.mailService.readTemplate(type)) as string,
          source,
        ),
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
        subject: `[${seo.title || 'Mx Space'}] 有新回复了耶~`,
        to,
        html: render(
          (await this.mailService.readTemplate(type)) as string,
          source,
        ),
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

  // push comment
  @OnEvent(BusinessEvents.COMMENT_CREATE)
  async pushCommentEvent(comment: CommentModel) {
    const { enable } = await this.configsService.get('barkOptions')
    if (!enable) {
      return
    }
    const master = await this.userService.getMaster()
    if (comment.author == master.name && comment.author == master.username) {
      return
    }
    const { adminUrl } = await this.configsService.get('url')

    await this.barkService.push({
      title: '收到一条新评论',
      body: `${comment.author} 评论了你的${
        comment.refType === CollectionRefTypes.Recently ? '速记' : '文章'
      }：${comment.text}`,
      icon: comment.avatar,
      url: `${adminUrl}#/comments`,
    })
  }
}

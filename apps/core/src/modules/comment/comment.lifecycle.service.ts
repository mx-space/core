import type { OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import ejs from 'ejs'
import { omit, pick } from 'es-toolkit/compat'

import { RequestContext } from '~/common/contexts/request.context'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'

import { ConfigsService } from '../configs/configs.service'
import { OwnerModel } from '../owner/owner.model'
import { OwnerService } from '../owner/owner.service'
import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import type { SnippetModel } from '../snippet/snippet.model'
import { SnippetType } from '../snippet/snippet.model'
import type {
  CommentEmailTemplateRenderProps,
  CommentModelRenderProps,
} from './comment.email.default'
import {
  baseRenderProps,
  defaultCommentModelKeys,
} from './comment.email.default'
import { CommentReplyMailType } from './comment.enum'
import { CommentModel, CommentState } from './comment.model'
import { CommentSpamFilterService } from './comment.spam-filter'

@Injectable()
export class CommentLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(CommentLifecycleService.name)

  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    private readonly databaseService: DatabaseService,
    private readonly configsService: ConfigsService,
    private readonly ownerService: OwnerService,
    private readonly mailService: EmailService,
    private readonly spamFilterService: CommentSpamFilterService,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
    private readonly eventManager: EventManagerService,
    private readonly barkService: BarkPushService,
  ) {}

  async onModuleInit() {
    const ownerInfo = await this.ownerService.getSiteOwnerOrMocked()
    const serialized = OwnerModel.serialize(ownerInfo)
    const renderProps = {
      ...baseRenderProps,
      owner: serialized.name,
      aggregate: {
        ...baseRenderProps.aggregate,
        owner: omit(serialized, [
          'password',
          'lastLoginIp',
          'lastLoginTime',
          'oauth2',
        ] as (keyof OwnerModel)[]),
      },
    }
    this.mailService.registerEmailType(CommentReplyMailType.Guest, {
      ...renderProps,
    })
    this.mailService.registerEmailType(CommentReplyMailType.Owner, {
      ...renderProps,
    })
  }

  async afterCreateComment(
    commentId: string,
    ipLocation: { ip: string },
    isAuthenticated: boolean,
  ) {
    const comment = await this.commentModel
      .findById(commentId)
      .lean({ getters: true })
      .select('+ip +agent')

    const readerId = RequestContext.currentRequest()?.readerId
    if (!comment) return

    scheduleManager.schedule(async () => {
      if (isAuthenticated) return
      await this.appendIpLocation(commentId, ipLocation.ip)
    })

    scheduleManager.batch(async () => {
      const configs = await this.configsService.get('commentOptions')
      const { commentShouldAudit } = configs

      if ((await this.spamFilterService.checkSpam(comment)) && !readerId) {
        await this.commentModel.updateOne(
          { _id: commentId },
          { state: CommentState.Junk },
        )
        return
      } else if (!isAuthenticated) {
        this.sendEmail(comment, CommentReplyMailType.Owner)
      }

      await this.eventManager.broadcast(
        BusinessEvents.COMMENT_CREATE,
        comment,
        { scope: EventScope.TO_SYSTEM_ADMIN },
      )

      if ((!commentShouldAudit || isAuthenticated) && !comment.isWhispers) {
        await this.eventManager.broadcast(
          BusinessEvents.COMMENT_CREATE,
          omit(comment, ['ip', 'agent']),
          { scope: EventScope.TO_VISITOR },
        )
      }
    })
  }

  async afterReplyComment(
    comment: CommentModel,
    ipLocation: { ip: string },
    isAuthenticated: boolean,
  ) {
    const commentId = comment.id ?? (comment as any)._id?.toString()

    scheduleManager.schedule(async () => {
      if (isAuthenticated) return
      await this.appendIpLocation(commentId, ipLocation.ip)
    })

    if (isAuthenticated) {
      this.sendEmail(comment, CommentReplyMailType.Guest)
      this.eventManager.broadcast(BusinessEvents.COMMENT_CREATE, comment, {
        scope: EventScope.TO_SYSTEM_VISITOR,
      })
    } else {
      const configs = await this.configsService.get('commentOptions')
      const { commentShouldAudit } = configs

      if (commentShouldAudit) {
        this.eventManager.broadcast(BusinessEvents.COMMENT_CREATE, comment, {
          scope: EventScope.TO_SYSTEM_ADMIN,
        })
        return
      }

      this.sendEmail(comment, CommentReplyMailType.Owner)
      this.eventManager.broadcast(BusinessEvents.COMMENT_CREATE, comment, {
        scope: EventScope.ALL,
      })
    }
  }

  async sendEmail(comment: CommentModel, type: CommentReplyMailType) {
    const enable = await this.configsService
      .get('mailOptions')
      .then((config) => config.enable)
    if (!enable) return

    const ownerInfo = await this.ownerService.getOwnerInfo()

    const refType = comment.refType
    const refModel = this.getModelByRefType(refType)
    const refDoc = await refModel.findById(comment.ref)
    const time = new Date(comment.created!)
    const parent: CommentModel | null = await this.commentModel
      .findOne({ _id: comment.parentCommentId })
      .lean()

    const parsedTime = `${time.getDate()}/${
      time.getMonth() + 1
    }/${time.getFullYear()}`

    if (!refDoc || !ownerInfo.mail) return
    if (type === CommentReplyMailType.Owner && !comment.mail) return
    if (type === CommentReplyMailType.Guest && !parent?.mail) return

    this.sendCommentNotificationMail({
      to: type === CommentReplyMailType.Owner ? ownerInfo.mail : parent!.mail,
      type,
      source: {
        title: refType === CollectionRefTypes.Recently ? '速记' : refDoc.title,
        text: comment.text,
        author:
          (type === CommentReplyMailType.Guest
            ? parent!.author
            : comment.author) || '',
        owner: ownerInfo.name,
        link: await this.resolveUrlByType(refType, refDoc).then(
          (url) => `${url}#comments-${comment.id}`,
        ),
        time: parsedTime,
        mail:
          CommentReplyMailType.Owner === type ? comment.mail : ownerInfo.mail,
        ip: comment.ip || '',
        aggregate: {
          owner: ownerInfo,
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

  async appendIpLocation(id: string, ip: string) {
    if (!ip) return

    const { recordIpLocation } = await this.configsService.get('commentOptions')
    if (!recordIpLocation) return

    const model = this.commentModel.findById(id).lean()
    if (!model) return

    const fnModel = (await this.serverlessService.model
      .findOne({
        name: 'ip',
        reference: 'built-in',
        type: SnippetType.Function,
      })
      .select('+secret')
      .lean({ getters: true })) as SnippetModel

    if (!fnModel) {
      this.logger.error('[Serverless Fn] ip query function is missing.')
      return model
    }

    const result =
      await this.serverlessService.injectContextIntoServerlessFunctionAndCall(
        fnModel,
        {
          req: { query: { ip } },
          res: createMockedContextResponse({} as any),
        } as any,
      )

    const location =
      `${result.countryName || ''}${
        result.regionName && result.regionName !== result.cityName
          ? String(result.regionName)
          : ''
      }${result.cityName ? String(result.cityName) : ''}` || undefined

    if (location) await this.commentModel.updateOne({ _id: id }, { location })
  }

  @OnEvent(BusinessEvents.COMMENT_CREATE)
  async pushCommentEvent(comment: CommentModel) {
    const { enable, enableComment } =
      await this.configsService.get('barkOptions')
    if (!enable || !enableComment) return

    const owner = await this.ownerService.getOwner()
    if (comment.author === owner.name || comment.author === owner.username) {
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

  private getModelByRefType(type: CollectionRefTypes) {
    return this.databaseService.getModelByRefType(type) as any
  }

  private async resolveUrlByType(type: CollectionRefTypes, model: any) {
    const {
      url: { webUrl: base },
    } = await this.configsService.waitForConfigReady()
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
        return new URL(`/thinking/${model._id}`, base).toString()
      }
    }
  }

  private async sendCommentNotificationMail({
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
    const senderEmail = mailOptions.from || mailOptions.smtp?.user
    const sendfrom = `"${seo.title || 'Mx Space'}" <${senderEmail}>`
    const subject =
      type === CommentReplyMailType.Guest
        ? `[${seo.title || 'Mx Space'}] 主人给你了新的回复呐`
        : `[${seo.title || 'Mx Space'}] 有新回复了耶~`

    source.ip ??= ''
    const options = {
      from: sendfrom,
      subject,
      to,
      html: ejs.render(
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

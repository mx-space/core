import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import ejs from 'ejs'
import { omit, pick } from 'es-toolkit/compat'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { scheduleManager } from '~/utils/schedule.util'
import { getAvatar } from '~/utils/tool.util'

import { ConfigsService } from '../configs/configs.service'
import { OwnerService } from '../owner/owner.service'
import { OwnerModel } from '../owner/owner.types'
import { ReaderService } from '../reader/reader.service'
import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import type {
  CommentEmailTemplateRenderProps,
  CommentModelRenderProps,
} from './comment.email.default'
import {
  baseRenderProps,
  defaultCommentModelKeys,
} from './comment.email.default'
import { CommentReplyMailType, CommentState } from './comment.enum'
import { CommentService } from './comment.service'
import { CommentSpamFilterService } from './comment.spam-filter'
import type { CommentModel } from './comment.types'

@Injectable()
export class CommentLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommentLifecycleService.name)
  private commentCreateListenerDisposer?: IEventManagerHandlerDisposer

  constructor(
    private readonly commentService: CommentService,
    private readonly databaseService: DatabaseService,
    private readonly configsService: ConfigsService,
    private readonly ownerService: OwnerService,
    private readonly readerService: ReaderService,
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

    this.commentCreateListenerDisposer = this.eventManager.registerHandler(
      (event: BusinessEvents, data, scope) => {
        if (event !== BusinessEvents.COMMENT_CREATE) return
        if ((scope & EventScope.TO_SYSTEM) === 0) return

        void this.pushCommentEvent(data)
      },
    )
  }

  onModuleDestroy() {
    this.commentCreateListenerDisposer?.()
  }

  async afterCreateComment(commentId: string, ipLocation: { ip: string }) {
    const comment = await this.commentService.findById(commentId)

    if (!comment) return
    const isLoggedInComment = !!comment.readerId

    scheduleManager.schedule(async () => {
      if (isLoggedInComment) return
      await this.appendIpLocation(commentId, ipLocation.ip)
    })

    scheduleManager.batch(async () => {
      const configs = await this.configsService.get('commentOptions')
      const { commentShouldAudit } = configs

      if (
        (await this.spamFilterService.checkSpam(comment)) &&
        !isLoggedInComment
      ) {
        await this.commentService.updateComment(commentId, {
          state: CommentState.Junk,
        })
        return
      }

      this.sendEmail(comment, CommentReplyMailType.Owner)

      await this.eventManager.broadcast(
        BusinessEvents.COMMENT_CREATE,
        comment,
        { scope: EventScope.TO_SYSTEM_ADMIN },
      )

      if ((!commentShouldAudit || isLoggedInComment) && !comment.isWhispers) {
        await this.eventManager.broadcast(
          BusinessEvents.COMMENT_CREATE,
          omit(comment, ['ip', 'agent']),
          { scope: EventScope.TO_VISITOR },
        )
      }
    })
  }

  async afterReplyComment(comment: CommentModel, ipLocation: { ip: string }) {
    const commentId = comment.id ?? (comment as any)._id?.toString()
    const isLoggedInComment = !!comment.readerId

    scheduleManager.schedule(async () => {
      if (isLoggedInComment) return
      await this.appendIpLocation(commentId, ipLocation.ip)
    })

    if (isLoggedInComment) {
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

  private async resolveReader(readerId?: string | null) {
    if (!readerId) {
      return null
    }

    return this.readerService
      .findReaderInIds([readerId])
      .then((readers) => readers[0] ?? null)
  }

  private toOwnerIdentity(
    ownerInfo: Awaited<ReturnType<OwnerService['getOwnerInfo']>>,
  ) {
    return {
      role: 'owner' as const,
      author: ownerInfo.name || '',
      mail: ownerInfo.mail || '',
      avatar: ownerInfo.avatar || getAvatar(ownerInfo.mail),
    }
  }

  private async resolveCommentIdentity(
    comment: Partial<CommentModel> | null | undefined,
    ownerInfo: Awaited<ReturnType<OwnerService['getOwnerInfo']>>,
  ) {
    if (!comment) {
      return {
        role: 'guest' as const,
        author: '',
        mail: '',
        avatar: '',
      }
    }

    if (comment.readerId) {
      const reader = await this.resolveReader(comment.readerId)
      if (reader) {
        if (reader.role === 'owner') {
          return this.toOwnerIdentity(ownerInfo)
        }

        return {
          role: 'reader' as const,
          author: reader.name || comment.author || '',
          mail: reader.email || comment.mail || '',
          avatar:
            reader.image ||
            comment.avatar ||
            getAvatar(reader.email || comment.mail),
        }
      }
    }

    return {
      role: 'guest' as const,
      author: comment.author || '',
      mail: comment.mail || '',
      avatar: comment.avatar || getAvatar(comment.mail),
    }
  }

  async sendEmail(comment: CommentModel, type: CommentReplyMailType) {
    const enable = await this.configsService
      .get('mailOptions')
      .then((config) => config.enable)
    if (!enable) return

    const ownerInfo = await this.ownerService.getOwnerInfo()

    const refType = comment.refType
    const result = await this.databaseService.findGlobalById(
      String(comment.ref),
    )
    const refDoc = result?.document as any
    const time = new Date(comment.created!)
    const parent: CommentModel | null = comment.parentCommentId
      ? await this.commentService.findById(String(comment.parentCommentId))
      : null

    const parsedTime = `${time.getDate()}/${
      time.getMonth() + 1
    }/${time.getFullYear()}`
    let commentIdentity = await this.resolveCommentIdentity(comment, ownerInfo)
    const parentIdentity = await this.resolveCommentIdentity(parent, ownerInfo)

    if (!refDoc || !ownerInfo.mail) return
    if (
      type === CommentReplyMailType.Guest &&
      commentIdentity.role === 'guest'
    ) {
      commentIdentity =
        !comment.author && !comment.mail && !comment.avatar
          ? this.toOwnerIdentity(ownerInfo)
          : commentIdentity
    }

    if (
      type === CommentReplyMailType.Owner &&
      commentIdentity.role === 'owner'
    ) {
      return
    }

    const recipientMail =
      type === CommentReplyMailType.Owner ? ownerInfo.mail : parentIdentity.mail
    if (!recipientMail) return

    const senderMail =
      type === CommentReplyMailType.Owner
        ? commentIdentity.mail
        : commentIdentity.mail || ownerInfo.mail

    this.sendCommentNotificationMail({
      to: recipientMail,
      type,
      source: {
        title: refType === CollectionRefTypes.Recently ? '速记' : refDoc.title,
        text: comment.text,
        author:
          (type === CommentReplyMailType.Guest
            ? parentIdentity.author
            : commentIdentity.author) || '',
        owner:
          type === CommentReplyMailType.Guest
            ? commentIdentity.author || ownerInfo.name
            : ownerInfo.name,
        link: await this.resolveUrlByType(refType, refDoc).then(
          (url) => `${url}#comments-${comment.id}`,
        ),
        time: parsedTime,
        mail: senderMail,
        ip: comment.ip || '',
        aggregate: {
          owner: ownerInfo,
          commentor: {
            ...pick(comment, defaultCommentModelKeys),
            author: commentIdentity.author,
            avatar: commentIdentity.avatar,
            mail: senderMail,
            created: new Date(comment.created!).toISOString(),
            isWhispers: comment.isWhispers || false,
          } as CommentModelRenderProps,
          parent: parent
            ? {
                ...parent,
                author: parentIdentity.author,
                avatar: parentIdentity.avatar,
                mail: parentIdentity.mail,
              }
            : null,
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

    const model = await this.commentService.findById(id)
    if (!model) return

    const fnModel =
      await this.serverlessService.repository.findFunctionByNameReference(
        'ip',
        'built-in',
      )

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

    if (location)
      await this.commentService.updateComment(id, { location } as any)
  }

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
        ? `[${seo.title || 'Mx Space'}] ${source.owner || '有人'}给你了新的回复`
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

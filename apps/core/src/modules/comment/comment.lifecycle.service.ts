import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import ejs from 'ejs'
import { omit, pick } from 'es-toolkit/compat'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import type { IEventManagerHandlerDisposer } from '~/processors/helper/helper.event.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { TaskQueueProcessor, TaskQueueService } from '~/processors/task-queue'
import { scheduleManager } from '~/utils/schedule.util'
import { getAvatar } from '~/utils/tool.util'

import { ConfigsService } from '../configs/configs.service'
import { FileReferenceService } from '../file/file-reference.service'
import { FileDeletionReason } from '../file/file-reference.types'
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
import { CommentRepository } from './comment.repository'
import { CommentService } from './comment.service'
import { CommentSpamFilterService } from './comment.spam-filter'
import type { CommentModel } from './comment.types'
import { commentSubmissionStatus } from './comment-decision'

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
    private readonly fileReferenceService: FileReferenceService,
    private readonly repository: CommentRepository,
    private readonly taskQueue: TaskQueueService,
    private readonly processor: TaskQueueProcessor,
  ) {}

  async onModuleInit() {
    this.processor.registerHandler<{ commentId: string }>({
      type: 'comment:review',
      execute: async ({ commentId }, context) =>
        this.reviewComment(commentId, context.signal),
    })
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
    this.processor.unregisterHandler('comment:review')
    this.commentCreateListenerDisposer?.()
  }

  private async cascadeDeleteFilesIfSpamConfigured(commentId: string) {
    try {
      const config = await this.configsService.get('commentUploadOptions')
      if (config.deleteFilesOnSpam === false) return
      await this.fileReferenceService.hardDeleteFilesForComment(
        commentId,
        FileDeletionReason.CommentSpam,
      )
    } catch (err) {
      this.logger.warn(
        `cascade file delete after spam(${commentId}) failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  async afterCreateComment(commentId: string, ipLocation: { ip: string }) {
    const comment = await this.commentService.findById(commentId)
    if (!comment) return
    if (!comment.readerId)
      void this.appendIpLocation(commentId, ipLocation.ip).catch(() =>
        this.logger.warn('Comment location unavailable'),
      )
    if (comment.moderationStatus === 'pending') {
      await this.enqueueReview(comment)
      return
    }
    await this.notifyReviewResult(comment)
  }

  async afterReplyComment(comment: CommentModel, ipLocation: { ip: string }) {
    await this.afterCreateComment(comment.id, ipLocation)
  }

  private async enqueueReview(comment: CommentModel) {
    try {
      await this.taskQueue.createTask({
        type: 'comment:review',
        payload: { commentId: comment.id },
        dedupKey: `comment:review:${comment.id}`,
        scope: 'comment',
      })
    } catch {
      this.logger.warn(
        'Comment review enqueue failed; pending record will be recovered',
      )
    }
  }

  @Interval(30000)
  async recoverPendingReviews() {
    try {
      for (const comment of await this.repository.pendingReviews())
        await this.enqueueReview(comment)
    } catch {
      this.logger.warn('Comment review recovery unavailable')
    }
  }

  private async reviewComment(id: string, signal?: AbortSignal) {
    const comment = await this.repository.findById(id)
    if (!comment || comment.moderationStatus !== 'pending' || comment.isDeleted)
      return
    const attempts = await this.repository.beginReview(comment)
    if (attempts === null) return
    let status: 'approved' | 'rejected' | 'manual'
    try {
      if (attempts > 3) status = 'manual'
      else {
        const options = await this.configsService.get('commentOptions')
        status = (await this.spamFilterService.evaluateWithAI(
          comment.text,
          options.aiReviewType || 'binary',
          options.aiReviewThreshold ?? 5,
          signal,
        ))
          ? 'rejected'
          : 'approved'
      }
    } catch {
      signal?.throwIfAborted()
      if (attempts < 3)
        throw new Error('Comment review failed; pending record will be retried')
      status = 'manual'
    }
    signal?.throwIfAborted()
    const updated = await this.repository.finishReview(comment, status)
    if (updated) {
      await this.commentService.invalidateTabCountsCache()
      await this.notifyReviewResult(updated)
    }
  }

  private async notifyReviewResult(comment: CommentModel) {
    if (
      comment.moderationStatus === 'rejected' ||
      comment.state === CommentState.Junk
    ) {
      await this.cascadeDeleteFilesIfSpamConfigured(comment.id)
      return
    }
    const options = await this.configsService.get('commentOptions')
    const published =
      commentSubmissionStatus(comment, !!options.commentShouldAudit) ===
      'published'
    void this.sendEmail(
      comment,
      comment.isOwnerReply && published
        ? CommentReplyMailType.Guest
        : CommentReplyMailType.Owner,
    ).catch(() => this.logger.warn('Comment email failed'))
    const payload = await this.enrichForBroadcast(comment)
    await this.eventManager.broadcast(BusinessEvents.COMMENT_CREATE, payload, {
      scope: EventScope.TO_SYSTEM_ADMIN,
    })
    if (published && !comment.isWhispers) {
      await this.eventManager.broadcast(
        BusinessEvents.COMMENT_CREATE,
        omit(payload, ['ip', 'agent', 'mail']),
        { scope: EventScope.TO_VISITOR },
      )
    }
  }

  /**
   * Replaces `author`/`avatar` with the reader-resolved values, mirroring what
   * the comment list controllers do via `fillAndReplaceAvatarUrl`. Without
   * this step, logged-in (reader) comments broadcast `author: null`, which
   * the admin in-app/browser notification renders as "null: <text>".
   */
  private async enrichForBroadcast(
    comment: CommentModel,
  ): Promise<CommentModel> {
    const [enriched] = await this.commentService.fillAndReplaceAvatarUrl([
      { ...comment } as CommentModel,
    ])
    return enriched ?? comment
  }

  private async resolveReader(readerId?: string | null) {
    if (!readerId) return null
    const readers = await this.readerService.findReaderInIds([readerId])
    return readers[0] ?? null
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
    const mailOptions = await this.configsService.get('mailOptions')
    const enable = mailOptions.enable
    if (!enable) return

    const ownerInfo = await this.ownerService.getOwnerInfo()

    const refType = comment.refType
    const result = await this.databaseService.findGlobalById(
      String(comment.refId),
    )
    const refDoc = result?.document as any
    const time = new Date(comment.createdAt!)
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
        title:
          refType === CollectionRefTypes.Recently ? 'Thinking' : refDoc.title,
        text: comment.text,
        author:
          (type === CommentReplyMailType.Guest
            ? parentIdentity.author
            : commentIdentity.author) || '',
        owner:
          type === CommentReplyMailType.Guest
            ? commentIdentity.author || ownerInfo.name
            : ownerInfo.name,
        link: `${await this.resolveUrlByType(
          refType as CollectionRefTypes,
          refDoc,
        )}#comments-${comment.id}`,
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
            created: new Date(comment.createdAt!).toISOString(),
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
            created: new Date(refDoc.createdAt!).toISOString(),
            id: refDoc.id!,
            modified: refDoc.modifiedAt
              ? new Date(refDoc.modifiedAt!).toISOString()
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

    const fnModel = await this.serverlessService.repository.findFunctionByPath(
      'built-in/ip',
      'GET',
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

    const country = result.countryName ? String(result.countryName) : ''
    const region =
      result.regionName && result.regionName !== result.cityName
        ? String(result.regionName)
        : ''
    const city = result.cityName ? String(result.cityName) : ''
    const location = `${country}${region}${city}` || undefined

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
      title: 'New comment received',
      body: `${comment.author} commented on your ${
        comment.refType === CollectionRefTypes.Recently ? 'thinking' : 'article'
      }: ${comment.text}`,
      icon: comment.avatar ?? undefined,
      url: `${adminUrl}#/comments`,
    })
  }

  afterReportComment(commentId: string) {
    scheduleManager.schedule(async () => {
      const comment = await this.commentService.findById(commentId)
      if (!comment) return
      const { adminUrl } = await this.configsService.get('url')
      try {
        await this.barkService.push({
          title: 'Comment reported',
          body: comment.text.slice(0, 140),
          url: `${adminUrl}#/comments`,
        })
      } catch (err) {
        this.logger.warn(
          `bark after report(${commentId}) failed: ${err instanceof Error ? err.message : err}`,
        )
      }
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
        return new URL(`/thinking/${model.id}`, base).toString()
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
    const sendfrom = `"${seo.title || 'Mix Space'}" <${senderEmail}>`
    const subject =
      type === CommentReplyMailType.Guest
        ? `[${seo.title || 'Mix Space'}] ${source.owner || 'Someone'} has replied to you`
        : `[${seo.title || 'Mix Space'}] You have a new reply`

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
      const { html: _html, ...rest } = options
      this.logger.log({ ...rest, source })
      return
    }
    await this.mailService.send(options)
  }
}

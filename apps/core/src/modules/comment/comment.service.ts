import type { OnModuleInit } from '@nestjs/common'
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { ReturnModelType } from '@typegoose/typegoose/lib/types'
import DiffMatchPatch from 'diff-match-patch'
import ejs from 'ejs'
import { omit, pick } from 'es-toolkit/compat'
import { isObjectIdOrHexString, Types } from 'mongoose'

import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  type LexicalRootBlock,
  LexicalService,
} from '~/processors/helper/helper.lexical.service'
import type { WriteBaseModel } from '~/shared/model/write-base.model'
import { ContentFormat } from '~/shared/types/content-format.type'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'
import { getAvatar, hasChinese, md5 } from '~/utils/tool.util'

import { AI_PROMPTS } from '../ai/ai.prompts'
import { AiService } from '../ai/ai.service'
import { AITranslationModel } from '../ai/ai-translation/ai-translation.model'
import { ConfigsService } from '../configs/configs.service'
import { OwnerModel } from '../owner/owner.model'
import { OwnerService } from '../owner/owner.service'
import { ReaderModel } from '../reader/reader.model'
import { ReaderService } from '../reader/reader.service'
import { createMockedContextResponse } from '../serverless/mock-response.util'
import { ServerlessService } from '../serverless/serverless.service'
import type { SnippetModel } from '../snippet/snippet.model'
import { SnippetType } from '../snippet/snippet.model'
import BlockedKeywords from './block-keywords.json' with { type: 'json' }
import type {
  CommentEmailTemplateRenderProps,
  CommentModelRenderProps,
} from './comment.email.default'
import {
  baseRenderProps,
  defaultCommentModelKeys,
} from './comment.email.default'
import { CommentReplyMailType } from './comment.enum'
import {
  CommentAnchorMode,
  type CommentAnchorModel,
  CommentModel,
  CommentState,
} from './comment.model'
import type { CommentAnchorInput } from './comment.schema'

const dmp = new DiffMatchPatch()

@Injectable()
export class CommentService implements OnModuleInit {
  private readonly logger: Logger = new Logger(CommentService.name)
  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    private readonly databaseService: DatabaseService,
    private readonly ownerService: OwnerService,
    private readonly mailService: EmailService,

    private readonly configsService: ConfigsService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    @Inject(forwardRef(() => ServerlessService))
    private readonly serverlessService: ServerlessService,
    private readonly eventManager: EventManagerService,
    private readonly barkService: BarkPushService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
    private readonly lexicalService: LexicalService,
    @InjectModel(AITranslationModel)
    private readonly aiTranslationModel: MongooseModel<AITranslationModel>,
  ) {}

  private async getMailOwnerProps() {
    const ownerInfo = await this.ownerService.getSiteOwnerOrMocked()
    return OwnerModel.serialize(ownerInfo)
  }

  async onModuleInit() {
    const ownerInfo = await this.getMailOwnerProps()
    const renderProps = {
      ...baseRenderProps,

      owner: ownerInfo.name,

      aggregate: {
        ...baseRenderProps.aggregate,
        owner: omit(ownerInfo, [
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
  public get model() {
    return this.commentModel
  }

  private getModelByRefType(
    type: CollectionRefTypes,
  ): ReturnModelType<typeof WriteBaseModel> {
    return this.databaseService.getModelByRefType(type) as any
  }

  private findRangeByQuoteContext(
    text: string,
    quote: string,
    prefix = '',
    suffix = '',
  ): { startOffset: number; endOffset: number } | null {
    if (!quote) return null

    const indexes: number[] = []
    let cursor = 0
    while (cursor <= text.length - quote.length) {
      const index = text.indexOf(quote, cursor)
      if (index === -1) break
      indexes.push(index)
      cursor = index + 1
    }

    if (!indexes.length) return null

    const expectedPrefix = prefix || ''
    const expectedSuffix = suffix || ''

    const withContext = indexes.find((index) => {
      const left = text.slice(Math.max(0, index - expectedPrefix.length), index)
      const right = text.slice(
        index + quote.length,
        index + quote.length + expectedSuffix.length,
      )
      const prefixMatched = expectedPrefix ? left === expectedPrefix : true
      const suffixMatched = expectedSuffix ? right === expectedSuffix : true
      return prefixMatched && suffixMatched
    })

    const picked = withContext ?? (indexes.length === 1 ? indexes[0] : null)
    if (picked == null) {
      return null
    }

    return {
      startOffset: picked,
      endOffset: picked + quote.length,
    }
  }

  private projectRangeFromSnapshot(
    snapshotText: string,
    currentText: string,
    startOffset: number,
    endOffset: number,
  ): { startOffset: number; endOffset: number } | null {
    const safeStart = Math.max(0, Math.min(startOffset, snapshotText.length))
    const safeEnd = Math.max(
      safeStart,
      Math.min(endOffset, snapshotText.length),
    )
    const selected = snapshotText.slice(safeStart, safeEnd)
    if (!selected) return null

    const patches = dmp.patch_make(snapshotText, currentText)
    const [projectedPrefix, prefixFlags] = dmp.patch_apply(
      patches,
      snapshotText.slice(0, safeStart),
    )
    const [projectedSelection, selectionFlags] = dmp.patch_apply(
      patches,
      snapshotText.slice(0, safeEnd),
    )

    if (
      !prefixFlags.every(Boolean) ||
      !selectionFlags.every(Boolean) ||
      typeof projectedPrefix !== 'string' ||
      typeof projectedSelection !== 'string'
    ) {
      return null
    }

    const nextStart = projectedPrefix.length
    const nextEnd = projectedSelection.length

    if (nextEnd < nextStart || nextEnd > currentText.length) {
      return null
    }

    return {
      startOffset: nextStart,
      endOffset: nextEnd,
    }
  }

  private findBlockByAnchor(
    anchor: Pick<
      CommentAnchorModel,
      'blockId' | 'blockFingerprint' | 'blockType' | 'snapshotText'
    >,
    blocks: LexicalRootBlock[],
  ): LexicalRootBlock | null {
    const blockById = blocks.find((block) => block.id === anchor.blockId)
    if (blockById) {
      return blockById
    }

    const byFingerprint = blocks.find((block) => {
      if (!anchor.blockFingerprint) return false
      if (block.fingerprint !== anchor.blockFingerprint) return false
      if (anchor.blockType && block.type !== anchor.blockType) return false
      return true
    })
    if (byFingerprint) {
      return byFingerprint
    }

    if (anchor.blockType) {
      const bySnapshot = blocks.find(
        (block) =>
          block.type === anchor.blockType && block.text === anchor.snapshotText,
      )
      if (bySnapshot) {
        return bySnapshot
      }
    }

    return null
  }

  private async resolveAnchorForCreate(
    anchor: CommentAnchorInput | undefined,
    refDoc: Pick<WriteBaseModel, 'contentFormat' | 'content'> & { _id: any },
  ): Promise<CommentAnchorModel | undefined> {
    if (!anchor) {
      return undefined
    }

    let lexicalContent: string | undefined

    if (anchor.lang) {
      const translation = await this.aiTranslationModel
        .findOne({ refId: refDoc._id.toString(), lang: anchor.lang })
        .lean()

      if (
        translation?.contentFormat === ContentFormat.Lexical &&
        translation.content &&
        typeof translation.content === 'string'
      ) {
        lexicalContent = translation.content
      }
    }

    if (!lexicalContent) {
      if (
        refDoc.contentFormat !== ContentFormat.Lexical ||
        !refDoc.content ||
        typeof refDoc.content !== 'string'
      ) {
        throw new BizException(
          ErrorCodeEnum.InvalidParameter,
          'Anchor comments are only supported for lexical content.',
        )
      }
      lexicalContent = refDoc.content
    }

    const blocks = this.lexicalService.extractRootBlocks(lexicalContent)
    const block = this.findBlockByAnchor(anchor, blocks)
    if (!block || !block.id) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Cannot find the anchor block in current lexical document.',
      )
    }

    const now = new Date()
    const contentHash = md5(lexicalContent)
    const langField = anchor.lang ?? undefined

    if (anchor.mode === CommentAnchorMode.Block) {
      return {
        mode: CommentAnchorMode.Block,
        blockId: block.id,
        blockType: block.type,
        blockFingerprint: block.fingerprint,
        snapshotText: block.text,
        contentHashAtCreate: contentHash,
        contentHashCurrent: contentHash,
        lastResolvedAt: now,
        lang: langField,
      }
    }

    const quote = anchor.quote
    if (!quote) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Range anchor quote cannot be empty.',
      )
    }

    const initialSlice = block.text.slice(anchor.startOffset, anchor.endOffset)

    const range =
      initialSlice === quote
        ? {
            startOffset: anchor.startOffset,
            endOffset: anchor.endOffset,
          }
        : this.findRangeByQuoteContext(
            block.text,
            quote,
            anchor.prefix,
            anchor.suffix,
          )

    if (!range) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        'Cannot resolve selected text in current block.',
      )
    }

    return {
      mode: CommentAnchorMode.Range,
      blockId: block.id,
      blockType: block.type,
      blockFingerprint: block.fingerprint,
      snapshotText: block.text,
      quote,
      prefix: anchor.prefix ?? '',
      suffix: anchor.suffix ?? '',
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      contentHashAtCreate: contentHash,
      contentHashCurrent: contentHash,
      lastResolvedAt: now,
      lang: langField,
    }
  }

  private resolveAnchorForUpdatedContent(
    anchor: CommentAnchorModel,
    blocks: LexicalRootBlock[],
    contentHash: string,
  ): CommentAnchorModel | null {
    const targetBlock = this.findBlockByAnchor(anchor, blocks)
    if (!targetBlock || !targetBlock.id) {
      return null
    }

    const baseAnchor = {
      ...anchor,
      blockId: targetBlock.id,
      blockType: targetBlock.type,
      blockFingerprint: targetBlock.fingerprint,
      snapshotText: targetBlock.text,
      contentHashCurrent: contentHash,
      lastResolvedAt: new Date(),
    }

    if (anchor.mode === CommentAnchorMode.Block) {
      return {
        ...baseAnchor,
        mode: CommentAnchorMode.Block,
      }
    }

    const quote = anchor.quote
    if (!quote) {
      return null
    }

    const currentSlice = targetBlock.text.slice(
      anchor.startOffset ?? 0,
      anchor.endOffset ?? 0,
    )

    let range =
      currentSlice === quote
        ? {
            startOffset: anchor.startOffset ?? 0,
            endOffset: anchor.endOffset ?? 0,
          }
        : this.findRangeByQuoteContext(
            targetBlock.text,
            quote,
            anchor.prefix ?? '',
            anchor.suffix ?? '',
          )

    if (!range && typeof anchor.snapshotText === 'string') {
      const projected = this.projectRangeFromSnapshot(
        anchor.snapshotText,
        targetBlock.text,
        anchor.startOffset ?? 0,
        anchor.endOffset ?? 0,
      )
      if (
        projected &&
        targetBlock.text.slice(projected.startOffset, projected.endOffset) ===
          quote
      ) {
        range = projected
      }
    }

    if (!range) {
      range = this.findRangeByQuoteContext(targetBlock.text, quote)
    }

    if (!range) {
      return null
    }

    return {
      ...baseAnchor,
      mode: CommentAnchorMode.Range,
      quote,
      prefix: anchor.prefix ?? '',
      suffix: anchor.suffix ?? '',
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    }
  }

  private async reanchorCommentsByRef(
    refType: CollectionRefTypes,
    refId: string,
  ) {
    if (!refId) return

    const refModel = this.getModelByRefType(refType)
    const refDoc = await refModel
      .findById(refId)
      .select('content contentFormat')
      .lean()

    if (
      !refDoc ||
      refDoc.contentFormat !== ContentFormat.Lexical ||
      !refDoc.content ||
      typeof refDoc.content !== 'string'
    ) {
      return
    }

    const blocks = this.lexicalService.extractRootBlocks(refDoc.content)
    const contentHash = md5(refDoc.content)

    const comments = await this.commentModel
      .find({
        ref: refId,
        refType,
        parent: undefined,
        anchor: { $exists: true },
        $or: [{ 'anchor.lang': null }, { 'anchor.lang': { $exists: false } }],
      })
      .lean()

    const deleting: string[] = []

    for (const comment of comments) {
      if (!comment.anchor) continue

      const nextAnchor = this.resolveAnchorForUpdatedContent(
        comment.anchor as CommentAnchorModel,
        blocks,
        contentHash,
      )

      if (!nextAnchor) {
        deleting.push(comment.id ?? comment._id.toString())
        continue
      }

      await this.commentModel.updateOne(
        { _id: comment._id },
        {
          $set: {
            anchor: nextAnchor,
          },
        },
      )
    }

    for (const id of deleting) {
      try {
        await this.deleteComments(id)
        await this.eventManager.emit(
          BusinessEvents.COMMENT_DELETE,
          { id },
          {
            scope: EventScope.TO_SYSTEM_VISITOR,
            nextTick: true,
          },
        )
      } catch (error) {
        this.logger.error(`failed to delete orphan anchor comment ${id}`, error)
      }
    }
  }

  /**
   * 使用 AI 评估评论内容
   * @param text 评论文本
   * @param aiReviewType 评审类型
   * @param aiReviewThreshold 阈值
   * @returns 是否应该被标记为垃圾评论
   */
  private async evaluateCommentWithAI(
    text: string,
    aiReviewType: 'binary' | 'score',
    aiReviewThreshold: number,
  ): Promise<boolean> {
    const runtime = await this.aiService.getCommentReviewModel()

    // 评分模式
    if (aiReviewType === 'score') {
      try {
        const { output } = await runtime.generateStructured({
          ...AI_PROMPTS.comment.score(text),
        })

        // 如果包含敏感内容直接拒绝
        if (output.hasSensitiveContent) {
          return true
        }
        // 否则根据评分判断
        return output.score > aiReviewThreshold
      } catch (error) {
        this.logger.error('AI 评审评分模式出错', error)
        return false
      }
    }
    // 垃圾检测模式
    else {
      try {
        const { output } = await runtime.generateStructured({
          ...AI_PROMPTS.comment.spam(text),
        })

        // 如果包含敏感内容直接拒绝
        if (output.hasSensitiveContent) {
          return true
        }
        // 否则按照是否 spam 判断
        return output.isSpam
      } catch (error) {
        this.logger.error('AI 评审垃圾检测模式出错', error)
        return false
      }
    }
  }

  async checkSpam(doc: CommentModel) {
    const res = await (async () => {
      const commentOptions = await this.configsService.get('commentOptions')
      if (!commentOptions.antiSpam) {
        return false
      }
      const owner = await this.ownerService.getOwner()
      if (doc.author === owner.username || doc.author === owner.name) {
        return false
      }
      if (commentOptions.blockIps) {
        if (!doc.ip) {
          return false
        }
        const isBlock = commentOptions.blockIps.some((ip) =>
          // @ts-ignore
          new RegExp(ip, 'gi').test(doc.ip),
        )
        if (isBlock) {
          return true
        }
      }

      const customKeywords = commentOptions.spamKeywords || []
      const isBlock = [...customKeywords, ...BlockedKeywords].some((keyword) =>
        new RegExp(keyword, 'gi').test(doc.text),
      )

      if (isBlock) {
        return true
      }

      if (commentOptions.disableNoChinese && !hasChinese(doc.text)) {
        return true
      }

      if (commentOptions.aiReview) {
        return this.evaluateCommentWithAI(
          doc.text,
          commentOptions.aiReviewType,
          commentOptions.aiReviewThreshold,
        )
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

  async assignReaderToComment(
    doc: Partial<CommentModel>,
  ): Promise<(ReaderModel & { id: string }) | null> {
    const readerId = RequestContext.currentRequest()?.readerId

    let reader: ReaderModel | null = null
    if (readerId) {
      reader = await this.readerService
        .findReaderInIds([readerId])
        .then((readers) => readers[0] ?? null)
    }

    if (!reader) {
      return null
    }
    doc.author = reader.name
    doc.mail = reader.email
    doc.avatar = reader.image

    return { ...reader, id: readerId! }
  }
  async createComment(
    id: string,
    doc: Partial<CommentModel>,
    type?: CollectionRefTypes,
  ) {
    const reader = await this.assignReaderToComment(doc)

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
      throw new BizException(ErrorCodeEnum.CommentPostNotExists)
    }
    const normalizedAnchor = await this.resolveAnchorForCreate(
      doc.anchor as CommentAnchorInput | undefined,
      ref,
    )
    if (normalizedAnchor) {
      doc.anchor = normalizedAnchor
    } else {
      delete (doc as Partial<CommentModel>).anchor
    }

    const commentIndex = ref.commentsIndex || 0
    doc.key = `#${commentIndex + 1}`

    const comment = await this.commentModel.create({
      ...doc,
      state: RequestContext.currentIsAuthenticated()
        ? CommentState.Read
        : CommentState.Unread,
      ref: new Types.ObjectId(id),
      readerId: reader ? reader.id : undefined,
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

    const readerId = RequestContext.currentRequest()?.readerId
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
      if ((await this.checkSpam(comment)) && !readerId) {
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

      if ((!commentShouldAudit || isAuthenticated) && !comment.isWhispers) {
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
    const isExist = await this.ownerService.isOwnerName(author)
    if (isExist) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
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
    const enable = await this.configsService
      .get('mailOptions')
      .then((config) => config.enable)
    if (!enable) {
      return
    }

    const ownerInfo = await this.ownerService.getOwnerInfo()

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

    if (!refDoc || !ownerInfo.mail) {
      return
    }

    this.sendCommentNotificationMail({
      to: type === CommentReplyMailType.Owner ? ownerInfo.mail : parent!.mail,
      type,
      source: {
        title: refType === CollectionRefTypes.Recently ? '速记' : refDoc.title,
        text: comment.text,
        author:
          type === CommentReplyMailType.Guest ? parent!.author : comment.author,
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

  async resolveUrlByType(type: CollectionRefTypes, model: any) {
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
          ? String(result.regionName)
          : ''
      }${result.cityName ? String(result.cityName) : ''}` || undefined

    if (location) await this.commentModel.updateOne({ _id: id }, { location })
  }

  async fillAndReplaceAvatarUrl(comments: CommentModel[]) {
    const owner = await this.ownerService.getOwner()

    comments.forEach(function process(comment) {
      if (typeof comment == 'string') {
        return
      }
      // 如果是 author 是站长，就用站长自己设定的头像替换
      if (comment.author === owner.name) {
        comment.avatar = owner.avatar || comment.avatar
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

  @OnEvent(BusinessEvents.POST_UPDATE)
  async handlePostUpdate(payload: { id?: string }) {
    if (!payload?.id) return
    await this.reanchorCommentsByRef(CollectionRefTypes.Post, payload.id)
  }

  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleNoteUpdate(payload: { id?: string }) {
    if (!payload?.id) return
    await this.reanchorCommentsByRef(CollectionRefTypes.Note, payload.id)
  }

  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async handlePageUpdate(payload: { id?: string }) {
    if (!payload?.id) return
    await this.reanchorCommentsByRef(CollectionRefTypes.Page, payload.id)
  }

  // push comment
  @OnEvent(BusinessEvents.COMMENT_CREATE)
  async pushCommentEvent(comment: CommentModel) {
    const { enable, enableComment } =
      await this.configsService.get('barkOptions')
    if (!enable || !enableComment) {
      return
    }
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

  async editComment(id: string, text: string) {
    const comment = await this.commentModel.findById(id).lean()
    if (!comment) {
      throw new CannotFindException()
    }
    await this.commentModel.updateOne(
      { _id: id },
      { text, editedAt: new Date() },
    )
    await this.eventManager.broadcast(
      BusinessEvents.COMMENT_UPDATE,
      { id, text },
      {
        scope: comment.isWhispers ? EventScope.TO_SYSTEM_ADMIN : EventScope.ALL,
      },
    )
  }
}

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { ReturnModelType } from '@typegoose/typegoose/lib/types'
import DiffMatchPatch from 'diff-match-patch'
import { Types } from 'mongoose'

import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import {
  type LexicalRootBlock,
  LexicalService,
} from '~/processors/helper/helper.lexical.service'
import type { WriteBaseModel } from '~/shared/model/write-base.model'
import { ContentFormat } from '~/shared/types/content-format.type'
import { InjectModel } from '~/transformers/model.transformer'
import { getAvatar, md5 } from '~/utils/tool.util'

import { AITranslationModel } from '../ai/ai-translation/ai-translation.model'
import { OwnerService } from '../owner/owner.service'
import { ReaderModel } from '../reader/reader.model'
import { ReaderService } from '../reader/reader.service'
import {
  CommentAnchorMode,
  type CommentAnchorModel,
  CommentModel,
  CommentState,
} from './comment.model'
import type { CommentAnchorInput } from './comment.schema'

const dmp = new DiffMatchPatch()
const COMMENT_REPLY_THRESHOLD = 20
const COMMENT_REPLY_EDGE_SIZE = 3
const COMMENT_THREAD_BATCH_SIZE = 10
const COMMENT_DELETED_PLACEHOLDER = '该评论已删除'

@Injectable()
export class CommentService {
  private readonly logger: Logger = new Logger(CommentService.name)
  constructor(
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    private readonly databaseService: DatabaseService,
    private readonly ownerService: OwnerService,

    private readonly eventManager: EventManagerService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
    private readonly lexicalService: LexicalService,
    @InjectModel(AITranslationModel)
    private readonly aiTranslationModel: MongooseModel<AITranslationModel>,
  ) {}

  public get model() {
    return this.commentModel
  }

  private toObjectId(id: string | Types.ObjectId | { _id?: unknown }) {
    if (id instanceof Types.ObjectId) {
      return id
    }

    if (typeof id === 'object' && id && '_id' in id) {
      return this.toObjectId((id as { _id?: unknown })._id as any)
    }

    return new Types.ObjectId(String(id))
  }

  private buildMixedIdCandidates(
    ids: Array<string | Types.ObjectId | undefined | null>,
  ) {
    const candidates: Array<string | Types.ObjectId> = []

    for (const id of ids) {
      if (!id) continue

      if (id instanceof Types.ObjectId) {
        candidates.push(id, id.toHexString())
        continue
      }

      const raw = String(id)
      candidates.push(raw)
      if (Types.ObjectId.isValid(raw)) {
        candidates.push(new Types.ObjectId(raw))
      }
    }

    const seen = new Set<string>()
    return candidates.filter((candidate) => {
      const key =
        candidate instanceof Types.ObjectId
          ? `oid:${candidate.toHexString()}`
          : `str:${candidate}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private createPublicQueryFilters({
    isAuthenticated,
    commentShouldAudit,
    hasAnchor,
  }: {
    isAuthenticated: boolean
    commentShouldAudit: boolean
    hasAnchor?: boolean
  }) {
    const filters: Record<string, any>[] = [
      {
        $or: commentShouldAudit
          ? [{ state: CommentState.Read }]
          : [{ state: CommentState.Read }, { state: CommentState.Unread }],
      },
    ]

    if (!isAuthenticated) {
      filters.push({
        $or: [{ isWhispers: false }, { isWhispers: { $exists: false } }],
      })
    }

    if (hasAnchor) {
      filters.push({ anchor: { $exists: true } })
    }

    return filters
  }

  private buildReplyWindow(replies: CommentModel[]) {
    if (replies.length <= COMMENT_REPLY_THRESHOLD) {
      return {
        replies,
        replyWindow: {
          total: replies.length,
          returned: replies.length,
          threshold: COMMENT_REPLY_THRESHOLD,
          hasHidden: false,
          hiddenCount: 0,
        },
      }
    }

    const head = replies.slice(0, COMMENT_REPLY_EDGE_SIZE)
    const tail = replies.slice(-COMMENT_REPLY_EDGE_SIZE)
    const selected = [...head]

    const seen = new Set(head.map((reply) => reply.id))
    for (const reply of tail) {
      if (!seen.has(reply.id)) {
        selected.push(reply)
      }
    }

    return {
      replies: selected,
      replyWindow: {
        total: replies.length,
        returned: selected.length,
        threshold: COMMENT_REPLY_THRESHOLD,
        hasHidden: true,
        hiddenCount: replies.length - selected.length,
        nextCursor: head.at(-1)?.id,
      },
    }
  }

  private collectNestedReaderIds(
    comments: Array<CommentModel & { replies?: CommentModel[] }>,
  ) {
    const readerIds = new Set<string>()

    for (const comment of comments) {
      if (comment.readerId) {
        readerIds.add(comment.readerId)
      }

      for (const reply of comment.replies || []) {
        if (reply.readerId) {
          readerIds.add(reply.readerId)
        }
      }
    }

    return [...readerIds]
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
        $and: [
          {
            ref: refId,
            refType,
          },
          {
            $or: [
              { parentCommentId: null },
              { parentCommentId: { $exists: false } },
            ],
          },
          {
            $or: [
              { 'anchor.lang': null },
              { 'anchor.lang': { $exists: false } },
            ],
          },
        ],
        anchor: { $exists: true },
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
        await this.hardDeleteRootComment(id)
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

    const comment = (await this.commentModel.create({
      ...doc,
      state: RequestContext.currentIsAuthenticated()
        ? CommentState.Read
        : CommentState.Unread,
      ref: new Types.ObjectId(id),
      parentCommentId: null,
      replyCount: 0,
      isDeleted: false,
      readerId: reader ? reader.id : undefined,
      refType,
    })) as CommentModel & { _id: Types.ObjectId }

    await this.commentModel.updateOne(
      { _id: comment._id },
      {
        $set: {
          rootCommentId: null,
        },
      },
    )

    Object.assign(comment, {
      rootCommentId: null,
      parentCommentId: null,
      replyCount: 0,
      isDeleted: false,
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

  async validAuthorName(author: string): Promise<void> {
    const isExist = await this.ownerService.isOwnerName(author)
    if (isExist) {
      throw new BizException(
        ErrorCodeEnum.InvalidParameter,
        '用户名与主人重名啦，但是你好像并不是我的主人唉',
      )
    }
  }

  async replyComment(id: string, doc: Partial<CommentModel>) {
    const parent = await this.commentModel.findById(id)
    if (!parent) {
      throw new CannotFindException()
    }

    const reader = await this.assignReaderToComment(doc)
    const rootCommentId = parent.rootCommentId || parent._id

    const comment = (await this.commentModel.create({
      ...doc,
      state:
        doc.state ??
        (RequestContext.currentIsAuthenticated()
          ? CommentState.Read
          : CommentState.Unread),
      ref: this.toObjectId(parent.ref as any),
      refType: parent.refType,
      parentCommentId: parent._id,
      rootCommentId,
      isWhispers: parent.isWhispers,
      readerId: reader ? reader.id : undefined,
      replyCount: 0,
      isDeleted: false,
    })) as CommentModel & { _id: Types.ObjectId; created?: Date }

    await this.commentModel.updateOne(
      { _id: rootCommentId },
      {
        $inc: { replyCount: 1 },
        $set: { latestReplyAt: comment.created ?? new Date() },
      },
    )

    Object.assign(comment, {
      parentCommentId: parent._id,
      rootCommentId,
      replyCount: 0,
      isDeleted: false,
    })

    return comment
  }

  async softDeleteComment(id: string) {
    const comment = await this.commentModel.findById(id).lean()
    if (!comment) {
      throw new NoContentCanBeModifiedException()
    }

    if (comment.isDeleted) {
      return
    }

    await this.commentModel.updateOne(
      { _id: id },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          text: COMMENT_DELETED_PLACEHOLDER,
          editedAt: new Date(),
        },
      },
    )
  }

  async deleteComments(id: string) {
    return this.softDeleteComment(id)
  }

  private async hardDeleteRootComment(id: string) {
    await this.commentModel.deleteMany({
      $or: [{ _id: id }, { rootCommentId: id }],
    })
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
        select: '+ip +agent',
        page,
        limit: size,
        populate: [
          { path: 'parentCommentId' },
          {
            path: 'ref',
            select: 'title _id slug nid categoryId content',
          },
        ],
        sort: { created: -1 },
        autopopulate: false,
      },
    )

    await this.fillAndReplaceAvatarUrl(queryList.docs)

    return queryList
  }

  async getCommentsByRefId(
    refId: string,
    {
      page,
      size,
      isAuthenticated,
      commentShouldAudit,
      hasAnchor = false,
    }: {
      page: number
      size: number
      isAuthenticated: boolean
      commentShouldAudit: boolean
      hasAnchor?: boolean
    },
  ) {
    const filters = this.createPublicQueryFilters({
      isAuthenticated,
      commentShouldAudit,
      hasAnchor,
    })

    const comments = await this.commentModel.paginate(
      {
        $and: [
          { ref: refId },
          {
            $or: [
              { parentCommentId: null },
              { parentCommentId: { $exists: false } },
            ],
          },
          ...filters,
        ],
      },
      {
        limit: size,
        page,
        sort: { pin: -1, created: -1 },
        lean: true,
        autopopulate: false,
      },
    )

    const rootIds = comments.docs.map((comment: any) =>
      (comment.rootCommentId || comment._id).toString(),
    )

    const replies = rootIds.length
      ? await this.commentModel
          .find({
            $and: [
              {
                rootCommentId: {
                  $in: this.buildMixedIdCandidates(rootIds),
                },
              },
              { parentCommentId: { $ne: null } },
              ...filters,
            ],
          })
          .sort({ created: 1 })
          .lean()
      : []

    const repliesByRootId = new Map<string, CommentModel[]>()
    for (const reply of replies as CommentModel[]) {
      const key = String(reply.rootCommentId)
      const current = repliesByRootId.get(key) || []
      current.push(reply)
      repliesByRootId.set(key, current)
    }

    const docs = comments.docs.map((comment: any) => {
      const rootId = String(comment.rootCommentId || comment._id)
      const threadReplies = repliesByRootId.get(rootId) || []
      const { replies, replyWindow } = this.buildReplyWindow(threadReplies)

      return {
        ...comment,
        rootCommentId: comment.rootCommentId ?? null,
        parentCommentId: comment.parentCommentId ?? null,
        replies,
        replyWindow,
      }
    })

    await this.fillAndReplaceAvatarUrl([
      ...docs,
      ...docs.flatMap((comment) => comment.replies || []),
    ] as CommentModel[])

    return {
      ...comments,
      docs,
    }
  }

  async getThreadReplies(
    rootCommentId: string,
    {
      cursor,
      size = COMMENT_THREAD_BATCH_SIZE,
      isAuthenticated,
      commentShouldAudit,
    }: {
      cursor?: string
      size?: number
      isAuthenticated: boolean
      commentShouldAudit: boolean
    },
  ) {
    const replies = (await this.commentModel
      .find({
        $and: [
          {
            rootCommentId: {
              $in: this.buildMixedIdCandidates([rootCommentId]),
            },
          },
          { parentCommentId: { $ne: null } },
          ...this.createPublicQueryFilters({
            isAuthenticated,
            commentShouldAudit,
          }),
        ],
      })
      .sort({ created: 1 })
      .lean()) as CommentModel[]

    const total = replies.length
    if (total <= COMMENT_REPLY_THRESHOLD) {
      await this.fillAndReplaceAvatarUrl(replies)
      return {
        replies,
        remaining: 0,
        done: true,
      }
    }

    const headSize = Math.min(COMMENT_REPLY_EDGE_SIZE, total)
    const tailStart = Math.max(headSize, total - COMMENT_REPLY_EDGE_SIZE)
    const middleStart = headSize
    const middleEnd = tailStart

    let startIndex = middleStart
    if (cursor) {
      const cursorIndex = replies.findIndex((reply) => reply.id === cursor)
      if (cursorIndex >= middleStart) {
        startIndex = cursorIndex + 1
      }
    }

    const nextReplies = replies.slice(
      startIndex,
      Math.min(startIndex + size, middleEnd),
    )
    await this.fillAndReplaceAvatarUrl(nextReplies)

    const consumedEnd = startIndex + nextReplies.length

    return {
      replies: nextReplies,
      nextCursor: nextReplies.at(-1)?.id,
      remaining: Math.max(0, middleEnd - consumedEnd),
      done: consumedEnd >= middleEnd,
    }
  }

  collectThreadReaderIds(
    comments: Array<CommentModel & { replies?: CommentModel[] }>,
  ) {
    return this.collectNestedReaderIds(comments)
  }

  cleanDirtyData<T>(docs: T[]) {
    return docs
  }

  async fillAndReplaceAvatarUrl(comments: CommentModel[]) {
    const owner = await this.ownerService.getOwner()

    comments.forEach(function process(comment) {
      if (typeof comment == 'string') {
        return
      }
      if (comment.author === owner.name) {
        comment.avatar = owner.avatar || comment.avatar
      }

      if (!comment.avatar) {
        comment.avatar = getAvatar(comment.mail)
      }

      const replies = (comment as CommentModel & { replies?: CommentModel[] })
        .replies
      if (replies?.length) {
        replies.forEach((child) => {
          process(child as CommentModel)
        })
      }

      return comment
    })

    return comments
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

  async editComment(id: string, text: string) {
    const comment = await this.commentModel.findById(id).lean()
    if (!comment) {
      throw new CannotFindException()
    }
    if (comment.isDeleted) {
      throw new NoContentCanBeModifiedException()
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

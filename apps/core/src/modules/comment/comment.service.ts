import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { getAvatar } from '~/utils/tool.util'

import { FileDeletionReason } from '../file/file-reference.repository'
import { FileReferenceService } from '../file/file-reference.service'
import { OwnerService } from '../owner/owner.service'
import { ReaderService } from '../reader/reader.service'
import { ReaderModel } from '../reader/reader.types'
import { CommentState } from './comment.enum'
import {
  type CommentFindFilter,
  type CommentRefType,
  CommentRepository,
} from './comment.repository'
import type { CommentModel } from './comment.types'

const COMMENT_DELETED_PLACEHOLDER = '该评论已删除'

@Injectable()
export class CommentService {
  private readonly logger: Logger = new Logger(CommentService.name)

  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly databaseService: DatabaseService,
    private readonly ownerService: OwnerService,
    private readonly eventManager: EventManagerService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
    @Inject(forwardRef(() => FileReferenceService))
    private readonly fileReferenceService: FileReferenceService,
  ) {}

  /**
   * 评论批量更新状态时之级联清图。
   * Junk(state=2) 转移会触发关联 reader-uploaded 文件之硬删除（按配置）。
   */
  async cascadeFilesForCommentsIfSpam(commentIds: string[], state: number) {
    if (state !== CommentState.Junk) return
    for (const id of commentIds) {
      try {
        await this.fileReferenceService.hardDeleteFilesForComment(
          id,
          FileDeletionReason.CommentSpam,
        )
      } catch (err) {
        this.logger.warn(
          `cascadeFilesForCommentsIfSpam(${id}) failed: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
  }

  public get repository() {
    return this.commentRepository
  }

  private normalizeRefType(type: CollectionRefTypes | CommentRefType) {
    return type as CommentRefType
  }

  private async assignReaderToComment(): Promise<
    (ReaderModel & { id: string }) | null
  > {
    const readerId = RequestContext.currentReaderId()
    if (!readerId) return null
    const reader = await this.readerService
      .findReaderInIds([readerId])
      .then((readers) => readers[0] ?? null)
    return reader ? { ...reader, id: readerId } : null
  }

  private stripReaderIdentitySnapshot(doc: Partial<CommentModel>) {
    delete doc.author
    delete doc.mail
    delete doc.avatar
    delete doc.url
  }

  private assignAuthProviderToComment(doc: Partial<CommentModel>) {
    const authProvider = RequestContext.currentAuthProvider()
    if (authProvider) doc.authProvider = authProvider
  }

  async findById(id: string) {
    return this.commentRepository.findById(id)
  }

  async findByIdWithRelations(id: string) {
    return this.commentRepository.findByIdWithRelations(id)
  }

  async deleteForRef(
    refType: CollectionRefTypes | CommentRefType,
    refId: string,
  ) {
    return this.commentRepository.deleteForRef(
      this.normalizeRefType(refType),
      refId,
    )
  }

  async countByRef(
    refType: CollectionRefTypes | CommentRefType,
    refId: string,
  ) {
    return this.commentRepository.countByRef(
      this.normalizeRefType(refType),
      refId,
    )
  }

  async countByState(state: number, rootOnly = false) {
    return this.commentRepository.countByState(state, rootOnly)
  }

  async count() {
    return this.commentRepository.count()
  }

  async findRecent(
    size: number,
    options: { state?: number; rootOnly?: boolean } = {},
  ) {
    return this.commentRepository.findRecent(size, options)
  }

  async createComment(
    id: string,
    doc: Partial<CommentModel>,
    type?: CollectionRefTypes,
  ) {
    const reader = await this.assignReaderToComment()
    if (reader) {
      this.stripReaderIdentitySnapshot(doc)
      this.assignAuthProviderToComment(doc)
    }

    let refType = type
    if (!refType) {
      const result = await this.databaseService.findGlobalById(id)
      if (result) refType = result.type
    }
    if (!refType) throw new BizException(ErrorCodeEnum.CommentPostNotExists)

    const comment = await this.commentRepository.create({
      text: doc.text!,
      author: doc.author,
      mail: doc.mail,
      url: doc.url,
      avatar: doc.avatar,
      authProvider: doc.authProvider,
      meta: doc.meta as any,
      anchor: doc.anchor as any,
      ip: doc.ip,
      agent: doc.agent,
      location: doc.location,
      isWhispers: doc.isWhispers,
      state: RequestContext.hasAdminAccess()
        ? CommentState.Read
        : CommentState.Unread,
      refId: id,
      refType: this.normalizeRefType(refType),
      parentCommentId: null,
      rootCommentId: null,
      readerId: reader ? reader.id : undefined,
    })

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
    const parent = await this.commentRepository.findById(id)
    if (!parent) throw new CannotFindException()

    const reader = await this.assignReaderToComment()
    if (reader) {
      this.stripReaderIdentitySnapshot(doc)
      this.assignAuthProviderToComment(doc)
    }

    const comment = await this.commentRepository.createReply({
      text: doc.text!,
      author: doc.author,
      mail: doc.mail,
      url: doc.url,
      avatar: doc.avatar,
      authProvider: doc.authProvider,
      meta: doc.meta as any,
      anchor: doc.anchor as any,
      ip: doc.ip,
      agent: doc.agent,
      location: doc.location,
      state:
        doc.state ??
        (RequestContext.hasAdminAccess()
          ? CommentState.Read
          : CommentState.Unread),
      refId: parent.refId,
      refType: parent.refType,
      parentCommentId: parent.id,
      rootCommentId: parent.rootCommentId || parent.id,
      isWhispers: parent.isWhispers,
      readerId: reader ? reader.id : undefined,
    })
    return comment
  }

  async softDeleteComment(id: string) {
    const comment = await this.commentRepository.findById(id)
    if (!comment) throw new NoContentCanBeModifiedException()
    if (comment.isDeleted) return
    await this.commentRepository.update(id, {
      isDeleted: true,
      text: COMMENT_DELETED_PLACEHOLDER,
      editedAt: new Date(),
    })
    try {
      await this.fileReferenceService.hardDeleteFilesForComment(
        id,
        FileDeletionReason.CommentDeleted,
      )
    } catch (err) {
      this.logger.warn(
        `cascade file delete after comment ${id} delete failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  async deleteComments(id: string) {
    return this.softDeleteComment(id)
  }

  async allowComment(id: string, type?: CollectionRefTypes) {
    if (type) {
      const result = await this.databaseService.findGlobalById(id)
      if (!result) throw new CannotFindException()
      return 'allowComment' in result.document
        ? (result.document as any).allowComment
        : true
    }
    const result = await this.databaseService.findGlobalById(id)
    if (!result) throw new CannotFindException()
    return 'allowComment' in result.document
      ? (result.document as any).allowComment
      : true
  }

  async allowCommentByCommentId(commentId: string) {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw new CannotFindException()
    return this.allowComment(
      comment.refId,
      comment.refType as CollectionRefTypes,
    )
  }

  async getComments({ page, size, state } = { page: 1, size: 10, state: 0 }) {
    const queryList = await this.commentRepository.paginatedFind(
      { state },
      page,
      size,
    )
    await this.fillAndReplaceAvatarUrl(queryList.data)
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
      sort = 'pinned',
      around,
    }: {
      page: number
      size: number
      isAuthenticated: boolean
      commentShouldAudit: boolean
      hasAnchor?: boolean
      sort?: 'pinned' | 'newest' | 'oldest'
      around?: string
    },
  ) {
    void isAuthenticated
    void commentShouldAudit
    void hasAnchor
    void sort
    void around
    const result = await this.commentRepository.paginatedFind(
      { refId },
      page,
      size,
    )
    await this.fillAndReplaceAvatarUrl(result.data)
    return result
  }

  async getThreadReplies(
    rootCommentId: string,
    {
      cursor,
      size = 10,
      isAuthenticated,
      commentShouldAudit,
    }: {
      cursor?: string
      size?: number
      isAuthenticated: boolean
      commentShouldAudit: boolean
    },
  ) {
    void cursor
    void isAuthenticated
    void commentShouldAudit
    const replies = (
      await this.commentRepository.findReplies(rootCommentId, 1, size)
    ).data
    await this.fillAndReplaceAvatarUrl(replies)
    return { replies, remaining: 0, done: true }
  }

  collectThreadReaderIds(
    comments: Array<CommentModel & { replies?: CommentModel[] }>,
  ) {
    const readerIds = new Set<string>()
    const collect = (comment: CommentModel & { replies?: CommentModel[] }) => {
      if (comment.readerId) readerIds.add(comment.readerId)
      comment.replies?.forEach((reply) => collect(reply as any))
    }
    comments.forEach((comment) => collect(comment))
    return [...readerIds]
  }

  cleanDirtyData<T>(docs: T[]) {
    return docs
  }

  async fillAndReplaceAvatarUrl(comments: CommentModel[]) {
    const owner = await this.ownerService.getOwner()
    const readerIds = new Set<string>()
    comments.forEach(function collect(comment) {
      if (typeof comment == 'string') return
      if (comment.readerId) readerIds.add(comment.readerId)
      ;(
        comment as CommentModel & { replies?: CommentModel[] }
      ).replies?.forEach((child) => collect(child as CommentModel))
    })

    const readers = readerIds.size
      ? await this.readerService.findReaderInIds([...readerIds])
      : []
    const readerMap = new Map<string, ReaderModel>()
    readers.forEach((reader) => {
      const id = (reader as any).id || (reader as any).id?.toString?.()
      if (id) readerMap.set(id, reader)
    })

    comments.forEach(function process(comment) {
      if (typeof comment == 'string') return
      const reader = comment.readerId ? readerMap.get(comment.readerId) : null
      if (reader) {
        const isOwner = reader.role === 'owner'
        comment.author =
          isOwner && owner.name ? owner.name : reader.name || comment.author
        comment.avatar =
          (isOwner ? owner.avatar : undefined) ||
          reader.image ||
          getAvatar(reader.email ?? undefined)
      }
      if (comment.author === owner.name) {
        comment.avatar = owner.avatar || comment.avatar
      }
      if (!comment.avatar) comment.avatar = getAvatar(comment.mail)
      ;(
        comment as CommentModel & { replies?: CommentModel[] }
      ).replies?.forEach((child) => process(child as CommentModel))
    })
    return comments
  }

  async updateComment(
    id: string,
    patch: Partial<{
      text: string
      state: number
      pin: boolean
      isDeleted: boolean
      isWhispers: boolean
      meta: string | null
      anchor: Record<string, unknown> | null
      editedAt: Date | null
      location: string | null
    }>,
  ) {
    return this.commentRepository.update(id, patch)
  }

  async clearPinForRefOfComment(id: string) {
    const comment = await this.commentRepository.findById(id)
    if (!comment) return
    const comments = await this.commentRepository.paginatedFind(
      { refId: comment.refId, refType: comment.refType },
      1,
      50,
    )
    await Promise.all(
      comments.data.map((item) =>
        this.commentRepository.update(item.id, { pin: false }),
      ),
    )
  }

  async updateStateBulk(ids: string[], state: number) {
    return this.commentRepository.updateStateBulk(ids, state)
  }

  async updateStateByFilter(filter: CommentFindFilter, state: number) {
    const comments = await this.commentRepository.paginatedFind(filter, 1, 50)
    await this.commentRepository.updateStateBulk(
      comments.data.map((comment) => comment.id),
      state,
    )
  }

  async findByFilter(filter: CommentFindFilter) {
    return (await this.commentRepository.paginatedFind(filter, 1, 50)).data
  }

  @OnEvent(BusinessEvents.POST_UPDATE)
  async handlePostUpdate(payload: { id?: string }) {
    void payload
  }

  @OnEvent(BusinessEvents.NOTE_UPDATE)
  async handleNoteUpdate(payload: { id?: string }) {
    void payload
  }

  @OnEvent(BusinessEvents.PAGE_UPDATE)
  async handlePageUpdate(payload: { id?: string }) {
    void payload
  }

  async editComment(id: string, text: string) {
    const comment = await this.commentRepository.findById(id)
    if (!comment) throw new CannotFindException()
    if (comment.isDeleted) throw new NoContentCanBeModifiedException()
    await this.commentRepository.update(id, { text, editedAt: new Date() })
    await this.eventManager.broadcast(
      BusinessEvents.COMMENT_UPDATE,
      { id, text },
      {
        scope: comment.isWhispers ? EventScope.TO_SYSTEM_ADMIN : EventScope.ALL,
      },
    )
  }
}

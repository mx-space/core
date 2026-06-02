import {
  Body,
  Delete,
  forwardRef,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common'
import { isUndefined, keyBy } from 'es-toolkit/compat'
import type { FastifyReply } from 'fastify'

import { RequestContext } from '~/common/contexts/request.context'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { ConfigsService } from '../configs/configs.service'
import { ReaderService } from '../reader/reader.service'
import { CommentFilterEmailInterceptor } from './comment.interceptor'
import { CommentLifecycleService } from './comment.lifecycle.service'
import {
  BatchCommentDeleteDto,
  BatchCommentStateDto,
  CommentAdminPagerDto,
  CommentAuthorActivityQueryDto,
  CommentDto,
  CommentRefTypesDto,
  CommentSourceCandidatesQueryDto,
  CommentStatePatchDto,
  CommentTabCountsQueryDto,
  EditCommentDto,
  ReaderCommentDto,
  ReaderReplyCommentDto,
  ReplyCommentDto,
} from './comment.schema'
import { CommentService } from './comment.service'
import type {
  CommentFindFilter,
  CommentModel,
  CommentTab,
} from './comment.types'

const idempotenceMessage = 'Whoops, you already said this'

@ApiController({ path: 'comments' })
@UseInterceptors(CommentFilterEmailInterceptor)
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly lifecycleService: CommentLifecycleService,
    private readonly eventManager: EventManagerService,
    private readonly configsService: ConfigsService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
  ) {}

  private buildAdminCommentFilter(input: {
    currentState?: number
    refId?: string
    refType?: string
    search?: string
    state?: number | 'all'
    tab?: CommentTab
    author?: string
  }): CommentFindFilter {
    const filter: CommentFindFilter = {}
    if (input.tab) {
      filter.tab = input.tab
    } else {
      const state = input.currentState ?? input.state
      if (!isUndefined(state) && state !== 'all') filter.state = state
    }
    if (input.refType)
      filter.refType = input.refType as CommentFindFilter['refType']
    if (input.refId) filter.refId = input.refId
    if (input.search) filter.search = input.search
    if (input.author) filter.author = input.author
    return filter
  }

  private async createCommentWithBody(
    params: EntityIdDto,
    body: Partial<CommentModel>,
    ipLocation: IpRecord,
    query: CommentRefTypesDto,
  ) {
    const hasAdminAccess = RequestContext.hasAdminAccess()
    const { ref } = query
    const id = params.id

    if (!hasAdminAccess && !(await this.commentService.allowComment(id, ref))) {
      throw createAppException(AppErrorCode.COMMENT_FORBIDDEN)
    }

    const model: Partial<CommentModel> = { ...body, ...ipLocation }
    const comment = await this.commentService.createComment(id, model, ref)

    this.lifecycleService.afterCreateComment(
      String((comment as any).id),
      ipLocation,
    )

    const [doc] = await this.commentService.fillAndReplaceAvatarUrl([comment])
    return doc
  }

  private async replyCommentWithBody(
    params: EntityIdDto,
    body: Partial<CommentModel>,
    ipLocation: IpRecord,
  ) {
    const hasAdminAccess = RequestContext.hasAdminAccess()
    if (
      !hasAdminAccess &&
      !(await this.commentService.allowCommentByCommentId(params.id))
    ) {
      throw createAppException(AppErrorCode.COMMENT_FORBIDDEN)
    }

    const model: Partial<CommentModel> = {
      ...body,
      ...ipLocation,
    }

    const comment = await this.commentService.replyComment(params.id, model)
    this.lifecycleService.afterReplyComment(comment, ipLocation)
    const [doc] = await this.commentService.fillAndReplaceAvatarUrl([comment])
    return doc
  }

  @Get('/')
  @Auth()
  async getRecentlyComments(
    @Query() query: CommentAdminPagerDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { size = 10, page = 1 } = query
    // Spec §6.2: legacy `?state=` is honored for one release with a
    // `Deprecation: true` response header so api-client can warn at the
    // boundary. `?tab=` takes precedence when both are present.
    if (!query.tab && query.state !== undefined) {
      reply.header('Deprecation', 'true')
    }
    const comments = await this.commentService.getComments({
      size,
      page,
      filter: this.buildAdminCommentFilter(query),
    })
    const readers = await this.readerService.findReaderInIds(
      comments.data.map((doc) => doc.readerId).filter(Boolean) as string[],
    )

    const readerMap = keyBy(readers, 'id')
    const data = comments.data.map((doc) => ({
      ...doc,
      reader: readerMap[(doc as any).readerId] ?? null,
    }))
    return withMeta(
      data,
      new MetaObjectBuilder().pagination(comments.pagination).build(),
    )
  }

  @Get('/tab-counts')
  @Auth()
  async getTabCounts(@Query() query: CommentTabCountsQueryDto) {
    return this.commentService.getTabCounts({
      refType: query.refType,
      refId: query.refId,
    })
  }

  @Get('/author-activity')
  @Auth()
  async getAuthorActivity(@Query() query: CommentAuthorActivityQueryDto) {
    return this.commentService.getAuthorActivity({
      mail: query.mail,
      ip: query.ip,
      limit: query.limit,
    })
  }

  @Get('/source-candidates')
  @Auth()
  async getSourceCandidates(@Query() query: CommentSourceCandidatesQueryDto) {
    const candidates = await this.commentService.getSourceCandidates({
      refType: query.refType,
      search: query.search,
      size: query.size,
    })
    return withMeta(candidates, new MetaObjectBuilder().build())
  }

  @Get('/ref/:id')
  async getCommentsByRefId(
    @Param() params: EntityIdDto,
    @Query() query: BasicPagerDto,
    @Query('hasAnchor') hasAnchor: string,
    @Query('sort') sort: string | undefined,
    @Query('around') around: string | undefined,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    const { id } = params
    const { page = 1, size = 10 } = query

    const configs = await this.configsService.get('commentOptions')
    const { commentShouldAudit } = configs

    const resolvedSort: 'pinned' | 'newest' | 'oldest' =
      sort === 'newest' || sort === 'oldest' || sort === 'pinned'
        ? sort
        : 'pinned'

    const comments = await this.commentService.getCommentsByRefId(id, {
      page,
      size,
      isAuthenticated: hasAdminAccess,
      commentShouldAudit,
      hasAnchor: hasAnchor === 'true',
      sort: resolvedSort,
      around,
    })

    const readerIds = this.commentService.collectThreadReaderIds(comments.data)
    const readers = await this.readerService.findReaderInIds(readerIds)

    const readerMap2 = keyBy(readers, 'id')
    const refData = comments.data.map((doc) => ({
      ...doc,
      reader: readerMap2[(doc as any).readerId] ?? null,
    }))
    return withMeta(
      refData,
      new MetaObjectBuilder().pagination(comments.pagination).build(),
    )
  }

  @Get('/thread/:rootCommentId')
  async getThreadReplies(
    @Param('rootCommentId') rootCommentId: string,
    @Query() query: BasicPagerDto,
    @Query('cursor') cursor: string,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    const { size = 10 } = query
    const configs = await this.configsService.get('commentOptions')

    const result = await this.commentService.getThreadReplies(rootCommentId, {
      cursor,
      size,
      isAuthenticated: hasAdminAccess,
      commentShouldAudit: configs.commentShouldAudit,
    })
    return {
      replies: result.replies,
      remaining: result.remaining,
      done: result.done,
      nextCursor: result.nextCursor ?? null,
    }
  }

  @Get('/:id/thread')
  @Auth()
  async getAdminThread(@Param() params: EntityIdDto) {
    const thread = await this.commentService.getAdminThreadForComment(params.id)
    if (!thread) {
      throw createAppException(AppErrorCode.COMMENT_NOT_FOUND, {
        id: params.id,
      })
    }
    return thread
  }

  @Get('/:id')
  async getComments(
    @Param() params: EntityIdDto,
    @HasAdminAccess() hasAdminAccess: boolean,
  ) {
    const { id } = params
    const data: CommentModel | null =
      await this.commentService.findByIdWithRelations(id)

    if (!data) {
      throw createAppException(AppErrorCode.COMMENT_NOT_FOUND, { id })
    }
    if (data.isWhispers && !hasAdminAccess) {
      throw createAppException(AppErrorCode.COMMENT_NOT_FOUND, { id })
    }

    await this.commentService.fillAndReplaceAvatarUrl([data])
    if (data.readerId) {
      const reader = await this.readerService.findReaderInIds([data.readerId])
      Object.assign(data, { reader: reader[0] })
    }

    return data
  }

  @Post('/guest/:id')
  @HTTPDecorators.Idempotence({ expired: 20, errorMessage: idempotenceMessage })
  async guestComment(
    @Param() params: EntityIdDto,
    @Body() body: CommentDto,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    const { allowGuestComment, disableComment } =
      await this.configsService.get('commentOptions')
    if (disableComment) {
      throw createAppException(AppErrorCode.COMMENT_DISABLED)
    }
    if (!allowGuestComment) {
      throw createAppException(AppErrorCode.COMMENT_FORBIDDEN)
    }

    await this.commentService.validAuthorName(body.author)
    return this.createCommentWithBody(params, body, ipLocation, query)
  }

  @Post('/reader/:id')
  @HTTPDecorators.Idempotence({ expired: 20, errorMessage: idempotenceMessage })
  async readerComment(
    @Param() params: EntityIdDto,
    @Body() body: ReaderCommentDto,
    @CurrentReaderId() readerId: string,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    const { disableComment } = await this.configsService.get('commentOptions')
    if (disableComment && !RequestContext.hasAdminAccess()) {
      throw createAppException(AppErrorCode.COMMENT_DISABLED)
    }
    if (!readerId) {
      throw createAppException(AppErrorCode.AUTH_NOT_LOGGED_IN)
    }
    return this.createCommentWithBody(params, body, ipLocation, query)
  }

  @Post('/guest/reply/:id')
  @HTTPDecorators.Idempotence({ expired: 20, errorMessage: idempotenceMessage })
  async guestReplyByCid(
    @Param() params: EntityIdDto,
    @Body() body: ReplyCommentDto,
    @IpLocation() ipLocation: IpRecord,
  ) {
    const { allowGuestComment, disableComment } =
      await this.configsService.get('commentOptions')
    if (disableComment) {
      throw createAppException(AppErrorCode.COMMENT_DISABLED)
    }
    if (!allowGuestComment) {
      throw createAppException(AppErrorCode.COMMENT_FORBIDDEN)
    }
    await this.commentService.validAuthorName(body.author)
    return this.replyCommentWithBody(params, body, ipLocation)
  }

  @Post('/owner-reply/:id')
  @Auth()
  @HTTPDecorators.Idempotence({ expired: 20, errorMessage: idempotenceMessage })
  async replyByCid(
    @Param() params: EntityIdDto,
    @Body() body: ReaderReplyCommentDto,
    @IpLocation() ipLocation: IpRecord,
  ) {
    return this.replyCommentWithBody(params, body, ipLocation)
  }

  @Post('/reader/reply/:id')
  @HTTPDecorators.Idempotence({ expired: 20, errorMessage: idempotenceMessage })
  async readerReplyByCid(
    @Param() params: EntityIdDto,
    @Body() body: ReaderReplyCommentDto,
    @CurrentReaderId() readerId: string,
    @IpLocation() ipLocation: IpRecord,
  ) {
    const { disableComment } = await this.configsService.get('commentOptions')
    if (disableComment && !RequestContext.hasAdminAccess()) {
      throw createAppException(AppErrorCode.COMMENT_DISABLED)
    }
    if (!readerId) {
      throw createAppException(AppErrorCode.AUTH_NOT_LOGGED_IN)
    }
    return this.replyCommentWithBody(params, body, ipLocation)
  }

  @Patch('/:id')
  @Auth()
  async modifyCommentState(
    @Param() params: EntityIdDto,
    @Body() body: CommentStatePatchDto,
  ) {
    const { id } = params
    const { state, pin } = body

    const updateResult: Record<string, any> = {}
    if (!isUndefined(state)) updateResult.state = state
    if (!isUndefined(pin)) updateResult.pin = pin

    if (pin) {
      await this.commentService.clearPinForRefOfComment(id)
    }

    try {
      await this.commentService.updateComment(id, updateResult)
    } catch {
      throw createAppException(AppErrorCode.NO_CONTENT_MODIFIABLE)
    }

    if (!isUndefined(state)) {
      await this.commentService.cascadeFilesForCommentsIfSpam([id], state)
    }
  }

  @Delete('/:id')
  @Auth()
  async deleteComment(@Param() params: EntityIdDto) {
    const { id } = params
    await this.commentService.softDeleteComment(id)
    await this.eventManager.emit(
      BusinessEvents.COMMENT_DELETE,
      { id },
      { scope: EventScope.TO_SYSTEM_VISITOR, nextTick: true },
    )
  }

  @Patch('/batch/state')
  @Auth()
  async batchUpdateState(@Body() body: BatchCommentStateDto) {
    const { ids, all, state } = body

    let affected: string[] = []
    if (all) {
      const filter = this.buildAdminCommentFilter(body)
      const matched = await this.commentService.findByFilter(filter)
      affected = matched.map((c) => String(c.id))
      await this.commentService.updateStateByFilter(filter, state)
    } else if (ids?.length) {
      affected = ids.map((id) => id.toString())
      await this.commentService.updateStateBulk(ids, state)
    }

    if (affected.length) {
      await this.commentService.cascadeFilesForCommentsIfSpam(affected, state)
    }
  }

  @Delete('/batch')
  @Auth()
  async batchDelete(@Body() body: BatchCommentDeleteDto) {
    const { ids, all } = body

    if (all) {
      const filter = this.buildAdminCommentFilter(body)
      const comments = await this.commentService.findByFilter(filter)
      await Promise.all(
        comments.map((comment) =>
          this.commentService.softDeleteComment(String(comment.id)),
        ),
      )
    } else if (ids?.length) {
      await Promise.all(
        ids.map((id) => this.commentService.softDeleteComment(id)),
      )
    }
  }

  @Patch('/edit/:id')
  async editComment(
    @Param() params: EntityIdDto,
    @Body() body: EditCommentDto,
    @HasAdminAccess() hasAdminAccess: boolean,
    @CurrentReaderId() readerId: string,
  ) {
    const { id } = params
    const { text } = body
    const comment = await this.commentService.findById(id)
    if (!comment) {
      throw createAppException(AppErrorCode.COMMENT_NOT_FOUND, { id })
    }
    if (comment.readerId !== readerId && !hasAdminAccess) {
      throw createAppException(AppErrorCode.COMMENT_FORBIDDEN)
    }
    await this.commentService.editComment(id, text)
  }
}

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
  UseInterceptors,
} from '@nestjs/common'
import { isUndefined, keyBy } from 'es-toolkit/compat'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { ConfigsService } from '../configs/configs.service'
import { ReaderService } from '../reader/reader.service'
import { CommentFilterEmailInterceptor } from './comment.interceptor'
import { CommentLifecycleService } from './comment.lifecycle.service'
import type { CommentModel } from './comment.model'
import { CommentState } from './comment.model'
import {
  BatchCommentDeleteDto,
  BatchCommentStateDto,
  CommentDto,
  CommentRefTypesDto,
  CommentStatePatchDto,
  EditCommentDto,
  ReaderCommentDto,
  ReaderReplyCommentDto,
  ReplyCommentDto,
} from './comment.schema'
import { CommentService } from './comment.service'

const idempotenceMessage = '哦吼，这句话你已经说过啦'
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

  private async createCommentWithBody(
    params: MongoIdDto,
    body: Partial<CommentModel>,
    isAuthenticated: boolean,
    ipLocation: IpRecord,
    query: CommentRefTypesDto,
  ) {
    const { ref } = query
    const id = params.id

    if (
      !(await this.commentService.allowComment(id, ref)) &&
      !isAuthenticated
    ) {
      throw new BizException(ErrorCodeEnum.CommentForbidden)
    }

    const model: Partial<CommentModel> = { ...body, ...ipLocation }
    const comment = await this.commentService.createComment(id, model, ref)

    this.lifecycleService.afterCreateComment(
      String((comment as any).id || (comment as any)._id),
      ipLocation,
      isAuthenticated,
    )

    return this.commentService
      .fillAndReplaceAvatarUrl([comment])
      .then((docs) => docs[0])
  }

  private async replyCommentWithBody(
    params: MongoIdDto,
    body: Partial<CommentModel>,
    isAuthenticated: boolean,
    ipLocation: IpRecord,
  ) {
    const model: Partial<CommentModel> = {
      ...body,
      ...ipLocation,
      state: isAuthenticated ? CommentState.Read : CommentState.Unread,
    }

    const comment = await this.commentService.replyComment(params.id, model)

    this.lifecycleService.afterReplyComment(
      comment,
      ipLocation,
      isAuthenticated,
    )

    return this.commentService
      .fillAndReplaceAvatarUrl([comment])
      .then((docs) => docs[0])
  }

  @Get('/')
  @Auth()
  async getRecentlyComments(@Query() query: PagerDto) {
    const { size = 10, page = 1, state = 0 } = query

    const comments = await this.commentService.getComments({
      size,
      page,
      state,
    })
    const readers = await this.readerService.findReaderInIds(
      comments.docs.map((doc) => doc.readerId).filter(Boolean) as string[],
    )

    const res = transformDataToPaginate(comments)
    Object.assign(res, {
      readers: keyBy(readers, 'id'),
    })
    return res
  }

  @Get('/ref/:id')
  async getCommentsByRefId(
    @Param() params: MongoIdDto,
    @Query() query: PagerDto,
    @Query('hasAnchor') hasAnchor: string,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { id } = params
    const { page = 1, size = 10 } = query

    const configs = await this.configsService.get('commentOptions')
    const { commentShouldAudit } = configs

    const comments = await this.commentService.getCommentsByRefId(id, {
      page,
      size,
      isAuthenticated,
      commentShouldAudit,
      hasAnchor: hasAnchor === 'true',
    })

    const result = transformDataToPaginate(comments)
    const readerIds = this.commentService.collectThreadReaderIds(comments.docs)
    const readers = await this.readerService.findReaderInIds(readerIds)

    Object.assign(result, {
      readers: keyBy(readers, 'id'),
    })

    return result
  }

  @Get('/thread/:rootCommentId')
  async getThreadReplies(
    @Param('rootCommentId') rootCommentId: string,
    @Query() query: PagerDto,
    @Query('cursor') cursor: string,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { size = 10 } = query
    const configs = await this.configsService.get('commentOptions')

    return this.commentService.getThreadReplies(rootCommentId, {
      cursor,
      size,
      isAuthenticated,
      commentShouldAudit: configs.commentShouldAudit,
    })
  }

  @Get('/:id')
  async getComments(
    @Param() params: MongoIdDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { id } = params
    const data: CommentModel | null = await this.commentService.model
      .findOne({
        _id: id,
      })
      .populate('parentCommentId')
      .lean()

    if (!data) {
      throw new CannotFindException()
    }
    if (data.isWhispers && !isAuthenticated) {
      throw new CannotFindException()
    }

    await this.commentService.fillAndReplaceAvatarUrl([data])
    if (data.readerId) {
      const reader = await this.readerService.findReaderInIds([data.readerId])
      Object.assign(data, {
        reader: reader[0],
      })
    }

    return data
  }

  @Post('/guest/:id')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async guestComment(
    @Param() params: MongoIdDto,
    @Body() body: CommentDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    const { allowGuestComment, disableComment } =
      await this.configsService.get('commentOptions')
    if (disableComment) {
      throw new BizException(ErrorCodeEnum.CommentDisabled)
    }
    if (!allowGuestComment) {
      throw new BizException(ErrorCodeEnum.CommentForbidden)
    }

    await this.commentService.validAuthorName(body.author)

    return this.createCommentWithBody(
      params,
      body,
      isAuthenticated,
      ipLocation,
      query,
    )
  }

  @Post('/reader/:id')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async readerComment(
    @Param() params: MongoIdDto,
    @Body() body: ReaderCommentDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @CurrentReaderId() readerId: string,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    const { disableComment } = await this.configsService.get('commentOptions')
    if (disableComment) {
      throw new BizException(ErrorCodeEnum.CommentDisabled)
    }
    if (!readerId) {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }

    return this.createCommentWithBody(
      params,
      body,
      isAuthenticated,
      ipLocation,
      query,
    )
  }

  @Post('/guest/reply/:id')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async guestReplyByCid(
    @Param() params: MongoIdDto,
    @Body() body: ReplyCommentDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @IpLocation() ipLocation: IpRecord,
  ) {
    const { allowGuestComment, disableComment } =
      await this.configsService.get('commentOptions')
    if (disableComment) {
      throw new BizException(ErrorCodeEnum.CommentDisabled)
    }

    if (!allowGuestComment) {
      throw new BizException(ErrorCodeEnum.CommentForbidden)
    }

    await this.commentService.validAuthorName(body.author)

    return this.replyCommentWithBody(params, body, isAuthenticated, ipLocation)
  }

  @Post('/reader/reply/:id')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async readerReplyByCid(
    @Param() params: MongoIdDto,
    @Body() body: ReaderReplyCommentDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @CurrentReaderId() readerId: string,
    @IpLocation() ipLocation: IpRecord,
  ) {
    const { disableComment } = await this.configsService.get('commentOptions')
    if (disableComment) {
      throw new BizException(ErrorCodeEnum.CommentDisabled)
    }

    if (!readerId) {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }

    return this.replyCommentWithBody(params, body, isAuthenticated, ipLocation)
  }

  @Patch('/:id')
  @Auth()
  async modifyCommentState(
    @Param() params: MongoIdDto,
    @Body() body: CommentStatePatchDto,
  ) {
    const { id } = params
    const { state, pin } = body

    const updateResult: Record<string, any> = {}

    if (!isUndefined(state)) updateResult.state = state
    if (!isUndefined(pin)) updateResult.pin = pin

    if (pin) {
      const currentRefModel = await this.commentService.model
        .findOne({
          _id: id,
        })
        .lean()
        .populate('ref')

      const refId = (currentRefModel?.ref as any)?._id
      if (refId) {
        await this.commentService.model.updateMany(
          {
            ref: refId,
          },
          {
            pin: false,
          },
        )
      }
    }

    try {
      await this.commentService.model.updateOne(
        {
          _id: id,
        },
        updateResult,
      )

      return
    } catch {
      throw new NoContentCanBeModifiedException()
    }
  }

  @Delete('/:id')
  @Auth()
  async deleteComment(@Param() params: MongoIdDto) {
    const { id } = params
    await this.commentService.softDeleteComment(id)
    await this.eventManager.emit(
      BusinessEvents.COMMENT_DELETE,
      { id },
      {
        scope: EventScope.TO_SYSTEM_VISITOR,
        nextTick: true,
      },
    )
    return
  }

  @Patch('/batch/state')
  @Auth()
  async batchUpdateState(@Body() body: BatchCommentStateDto) {
    const { ids, all, state, currentState } = body

    if (all) {
      const filter: Record<string, any> = {}
      if (!isUndefined(currentState)) {
        filter.state = currentState
      }
      await this.commentService.model.updateMany(filter, { state })
    } else if (ids?.length) {
      await this.commentService.model.updateMany(
        { _id: { $in: ids } },
        { state },
      )
    }

    return
  }

  @Delete('/batch')
  @Auth()
  async batchDelete(@Body() body: BatchCommentDeleteDto) {
    const { ids, all, state } = body

    if (all) {
      const filter: Record<string, any> = {}
      if (!isUndefined(state)) {
        filter.state = state
      }
      const comments = await this.commentService.model.find(filter).lean()
      for (const comment of comments) {
        await this.commentService.softDeleteComment(comment._id.toString())
      }
    } else if (ids?.length) {
      for (const id of ids) {
        await this.commentService.softDeleteComment(id)
      }
    }

    return
  }

  @Patch('/edit/:id')
  async editComment(
    @Param() params: MongoIdDto,
    @Body() body: EditCommentDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @CurrentReaderId() readerId: string,
  ) {
    const { id } = params
    const { text } = body
    const comment = await this.commentService.model.findById(id).lean()
    if (!comment) {
      throw new CannotFindException()
    }
    if (comment.readerId !== readerId && !isAuthenticated) {
      throw new BizException(ErrorCodeEnum.CommentForbidden)
    }
    await this.commentService.editComment(id, text)
  }
}

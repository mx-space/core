import { isUndefined } from 'lodash'
import type { DocumentType } from '@typegoose/typegoose'
import type { Document, FilterQuery } from 'mongoose'
import type { CommentModel } from './comment.model'

import {
  Body,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { IsMaster } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { scheduleManager } from '~/utils'

import { ConfigsService } from '../configs/configs.service'
import { UserModel } from '../user/user.model'
import {
  CommentDto,
  CommentRefTypesDto,
  CommentStatePatchDto,
  TextOnlyDto,
} from './comment.dto'
import { CommentReplyMailType } from './comment.enum'
import { CommentFilterEmailInterceptor } from './comment.interceptor'
import { CommentState } from './comment.model'
import { CommentService } from './comment.service'

const idempotenceMessage = '哦吼，这句话你已经说过啦'

@ApiController({ path: 'comments' })
@UseInterceptors(CommentFilterEmailInterceptor)
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly eventManager: EventManagerService,
    private readonly configsService: ConfigsService,
  ) {}

  @Get('/')
  @Auth()
  async getRecentlyComments(@Query() query: PagerDto) {
    const { size = 10, page = 1, state = 0 } = query
    return transformDataToPaginate(
      await this.commentService.getComments({ size, page, state }),
    )
  }

  @Get('/:id')
  async getComments(
    @Param() params: MongoIdDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { id } = params
    const data: CommentModel | null = await this.commentService.model
      .findOne({
        _id: id,
      })
      .populate('parent')
      .lean()

    if (!data) {
      throw new CannotFindException()
    }
    if (data.isWhispers && !isMaster) {
      throw new CannotFindException()
    }

    await this.commentService.fillAndReplaceAvatarUrl([data])
    return data
  }

  // 面向 C 端的评论查询接口
  @Get('/ref/:id')
  @HTTPDecorators.Paginator
  async getCommentsByRefId(
    @Param() params: MongoIdDto,
    @Query() query: PagerDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { id } = params
    const { page = 1, size = 10 } = query

    const configs = await this.configsService.get('commentOptions')
    const { commentShouldAudit } = configs

    const $and: FilterQuery<CommentModel & Document<any, any, any>>[] = [
      {
        parent: undefined,
        ref: id,
      },
      {
        $or: commentShouldAudit
          ? [
              {
                state: CommentState.Read,
              },
            ]
          : [
              {
                state: CommentState.Read,
              },
              { state: CommentState.Unread },
            ],
      },
    ]

    if (isMaster) {
      $and.push({
        $or: [
          { isWhispers: true },
          { isWhispers: false },
          {
            isWhispers: { $exists: false },
          },
        ],
      })
    } else {
      $and.push({
        $or: [
          { isWhispers: false },
          {
            isWhispers: { $exists: false },
          },
        ],
      })
    }
    const comments = await this.commentService.model.paginate(
      {
        $and,
      },
      {
        limit: size,
        page,
        sort: { pin: -1, created: -1 },
        lean: true,
      },
    )

    await this.commentService.fillAndReplaceAvatarUrl(comments.docs)
    this.commentService.cleanDirtyData(comments.docs)
    return comments
  }

  @Post('/:id')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async comment(
    @Param() params: MongoIdDto,
    @Body() body: CommentDto,
    @IsMaster() isMaster: boolean,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    const { disableComment } = await this.configsService.get('commentOptions')
    if (disableComment) {
      throw new BizException(ErrorCodeEnum.CommentDisabled)
    }
    if (!isMaster) {
      await this.commentService.validAuthorName(body.author)
    }

    const { ref } = query

    const id = params.id
    if (!(await this.commentService.allowComment(id, ref)) && !isMaster) {
      throw new ForbiddenException('主人禁止了评论')
    }

    const model: Partial<CommentModel> = { ...body, ...ipLocation }

    const comment = await this.commentService.createComment(id, model, ref)
    const commentId = comment._id.toString()
    scheduleManager.schedule(async () => {
      if (isMaster) {
        return
      }
      await this.commentService.appendIpLocation(commentId, ipLocation.ip)
    })

    scheduleManager.schedule(async () => {
      const configs = await this.configsService.get('commentOptions')
      const { commentShouldAudit } = configs
      if (await this.commentService.checkSpam(comment)) {
        comment.state = CommentState.Junk
        await comment.save()
        return
      } else if (!isMaster) {
        this.commentService.sendEmail(comment, CommentReplyMailType.Owner)
      }

      if (commentShouldAudit) {
        await this.eventManager.broadcast(
          BusinessEvents.COMMENT_CREATE,
          comment,
          {
            scope: EventScope.TO_SYSTEM_ADMIN,
          },
        )

        return
      }

      await this.eventManager.broadcast(
        BusinessEvents.COMMENT_CREATE,
        comment,
        {
          scope: isMaster
            ? EventScope.TO_SYSTEM_VISITOR
            : comment.isWhispers
            ? EventScope.TO_SYSTEM_ADMIN
            : EventScope.ALL,
        },
      )
    })

    return comment
  }

  @Post('/reply/:id')
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async replyByCid(
    @Param() params: MongoIdDto,
    @Body() body: CommentDto,
    @Body('author') author: string,
    @IsMaster() isMaster: boolean,
    @IpLocation() ipLocation: IpRecord,
  ) {
    const { disableComment } = await this.configsService.get('commentOptions')
    if (disableComment) {
      throw new BizException(ErrorCodeEnum.CommentDisabled)
    }

    if (!isMaster) {
      await this.commentService.validAuthorName(author)
    }

    const { id } = params

    const parent = await this.commentService.model.findById(id).populate('ref')
    if (!parent) {
      throw new CannotFindException()
    }
    const commentIndex = parent.commentsIndex

    if (parent.key && parent.key.split('#').length >= 10) {
      throw new BizException(ErrorCodeEnum.CommentTooDeep)
    }

    const key = `${parent.key}#${commentIndex}`

    const model: Partial<CommentModel> = {
      parent,
      ref: (parent.ref as DocumentType<any>)._id,
      refType: parent.refType,
      ...body,
      ...ipLocation,
      key,
    }

    const comment = await this.commentService.model.create(model)
    const commentId = comment._id.toString()
    scheduleManager.schedule(async () => {
      if (isMaster) {
        return
      }
      await this.commentService.appendIpLocation(commentId, ipLocation.ip)
    })

    await parent.updateOne({
      $push: {
        children: comment._id,
      },
      $inc: {
        commentsIndex: 1,
      },
      state:
        comment.state === CommentState.Read &&
        parent.state !== CommentState.Read
          ? CommentState.Read
          : parent.state,
    })
    if (isMaster) {
      this.commentService.sendEmail(comment, CommentReplyMailType.Guest)
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

      this.commentService.sendEmail(comment, CommentReplyMailType.Owner)
      this.eventManager.broadcast(BusinessEvents.COMMENT_CREATE, comment, {
        scope: EventScope.ALL,
      })
    }
    return comment
  }

  @Post('/master/comment/:id')
  @Auth()
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async commentByMaster(
    @CurrentUser() user: UserModel,
    @Param() params: MongoIdDto,
    @Body() body: TextOnlyDto,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    const { name, mail, url } = user
    const model: CommentDto = {
      author: name,
      ...body,
      mail,
      url,
      state: CommentState.Read,
    } as CommentDto
    return await this.comment(params, model as any, true, ipLocation, query)
  }

  @Post('/master/reply/:id')
  @Auth()
  @HTTPDecorators.Idempotence({
    expired: 20,
    errorMessage: idempotenceMessage,
  })
  async replyByMaster(
    @Req() req: any,
    @Param() params: MongoIdDto,
    @Body() body: TextOnlyDto,
    @IpLocation() ipLocation: IpRecord,
  ) {
    const { name, mail, url } = req.user
    const model: CommentDto = {
      author: name,
      ...body,
      mail,
      url,
      state: CommentState.Read,
    } as CommentDto
    // @ts-ignore
    return await this.replyByCid(params, model, undefined, true, ipLocation)
  }

  @Patch('/:id')
  @Auth()
  async modifyCommentState(
    @Param() params: MongoIdDto,
    @Body() body: CommentStatePatchDto,
  ) {
    const { id } = params
    const { state, pin } = body

    const updateResult = {} as any

    !isUndefined(state) && Reflect.set(updateResult, 'state', state)
    !isUndefined(pin) && Reflect.set(updateResult, 'pin', pin)

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
    await this.commentService.deleteComments(id)
    await this.eventManager.broadcast(BusinessEvents.COMMENT_DELETE, id, {
      scope: EventScope.TO_SYSTEM_VISITOR,
      nextTick: true,
    })
    return
  }
}

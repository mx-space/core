import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common'
import { ApiOperation, ApiParam } from '@nestjs/swagger'
import { DocumentType } from '@typegoose/typegoose'

import { Auth } from '~/common/decorator/auth.decorator'
import { CurrentUser } from '~/common/decorator/current-user.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ReplyMailType } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'

import { ToolService } from '../tool/tool.service'
import { UserModel } from '../user/user.model'
import {
  CommentDto,
  CommentRefTypesDto,
  StateDto,
  TextOnlyDto,
} from './comment.dto'
import { CommentFilterEmailInterceptor } from './comment.interceptor'
import { CommentModel, CommentState } from './comment.model'
import { CommentService } from './comment.service'

@Controller({ path: 'comments' })
@UseInterceptors(CommentFilterEmailInterceptor)
@ApiName
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly eventManager: EventManagerService,
    private readonly toolService: ToolService,
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
  @ApiOperation({ summary: '根据 comment id 获取评论, 包括子评论' })
  async getComments(@Param() params: MongoIdDto) {
    const { id } = params
    const data = await this.commentService.model
      .findOne({
        _id: id,
      })
      .populate('parent')
    if (!data) {
      throw new CannotFindException()
    }
    return data
  }

  @Get('/ref/:id')
  @ApiParam({
    name: 'id',
    description: 'refId',
    example: '5e6f67e85b303781d28072a3',
  })
  @ApiOperation({ summary: '根据评论的 refId 获取评论, 如 Post Id' })
  async getCommentsByRefId(
    @Param() params: MongoIdDto,
    @Query() query: PagerDto,
  ) {
    const { id } = params
    const { page = 1, size = 10 } = query
    const comments = await this.commentService.model.paginate(
      {
        parent: undefined,
        ref: id,
        $or: [
          {
            state: CommentState.Read,
          },
          { state: CommentState.Unread },
        ],
      },
      {
        limit: size,
        page,
        sort: { created: -1 },
      },
    )
    return transformDataToPaginate(comments)
  }

  @Post('/:id')
  @ApiOperation({ summary: '根据文章的 _id 评论' })
  async comment(
    @Param() params: MongoIdDto,
    @Body() body: CommentDto,
    @IsMaster() isMaster: boolean,
    @IpLocation() ipLocation: IpRecord,
    @Query() query: CommentRefTypesDto,
  ) {
    if (!isMaster) {
      await this.commentService.ValidAuthorName(body.author)
    }
    const { ref } = query

    const id = params.id
    if (!(await this.commentService.allowComment(id, ref)) && !isMaster) {
      throw new ForbiddenException('主人禁止了评论')
    }

    const model: Partial<CommentModel> = { ...body, ...ipLocation }

    if (ipLocation.ip) {
      model.location = await this.toolService
        .getIp(ipLocation.ip)
        .then(
          (res) =>
            `${res.cityName ? `${res.cityName}` : ''}${
              res.regionName ? `-${res.regionName}` : ''
            }` || undefined,
        )
        .catch(() => undefined)
    }

    const comment = await this.commentService.createComment(id, model, ref)

    process.nextTick(async () => {
      if (await this.commentService.checkSpam(comment)) {
        comment.state = CommentState.Junk
        await comment.save()
        return
      } else if (!isMaster) {
        this.commentService.sendEmail(comment, ReplyMailType.Owner)
      }

      await this.eventManager.broadcast(
        BusinessEvents.COMMENT_CREATE,
        comment,
        {
          scope: isMaster ? EventScope.TO_SYSTEM_VISITOR : EventScope.ALL,
        },
      )
    })

    return comment
  }

  @Post('/reply/:id')
  @ApiParam({
    name: 'id',
    description: 'cid',
    example: '5e7370bec56432cbac578e2d',
  })
  async replyByCid(
    @Param() params: MongoIdDto,
    @Body() body: CommentDto,
    @Body('author') author: string,
    @IsMaster() isMaster: boolean,
    @IpLocation() ipLocation: IpRecord,
  ) {
    if (!isMaster) {
      await this.commentService.ValidAuthorName(author)
    }

    const { id } = params

    const parent = await this.commentService.model.findById(id).populate('ref')
    if (!parent) {
      throw new CannotFindException()
    }
    const commentIndex = parent.commentsIndex
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
      this.commentService.sendEmail(comment, ReplyMailType.Guest)
    } else {
      this.commentService.sendEmail(comment, ReplyMailType.Owner)
      this.eventManager.broadcast(BusinessEvents.COMMENT_CREATE, comment, {
        scope: EventScope.ALL,
      })
    }
    return comment
  }

  @Post('/master/comment/:id')
  @ApiOperation({ summary: '主人专用评论接口 需要登录' })
  @Auth()
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
  @ApiOperation({ summary: '主人专用评论回复 需要登录' })
  @ApiParam({ name: 'id', description: 'cid' })
  @Auth()
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
  @ApiOperation({ summary: '修改评论的状态' })
  @HttpCode(204)
  @Auth()
  async modifyCommentState(
    @Param() params: MongoIdDto,
    @Body() body: StateDto,
  ) {
    const { id } = params
    const { state } = body

    try {
      await this.commentService.model.updateOne(
        {
          _id: id,
        },
        { state },
      )

      return
    } catch {
      throw new CannotFindException()
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

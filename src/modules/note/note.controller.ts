import { FilterQuery } from 'mongoose'

import {
  BadRequestException,
  Body,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { ApiName } from '~/common/decorators/openapi.decorator'
import { IsMaster } from '~/common/decorators/role.decorator'
import { VisitDocument } from '~/common/decorators/update-count.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { IntIdOrMongoIdDto, MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { addYearCondition } from '~/transformers/db-query.transformer'

import {
  ListQueryDto,
  NidType,
  NotePasswordQueryDto,
  NoteQueryDto,
} from './note.dto'
import { NoteModel, PartialNoteModel } from './note.model'
import { NoteService } from './note.service'

@ApiName
@ApiController({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,

    private readonly macrosService: TextMacroService,
  ) {}

  @Get('/')
  @Paginator
  @ApiOperation({ summary: '获取记录带分页器' })
  async getNotes(@IsMaster() isMaster: boolean, @Query() query: NoteQueryDto) {
    const { size, select, page, sortBy, sortOrder, year, db_query } = query
    const condition = {
      ...addYearCondition(year),
    }

    if (!isMaster) {
      Object.assign(condition, this.noteService.publicNoteQueryCondition)
    }

    return await this.noteService.model.paginate(db_query ?? condition, {
      limit: size,
      page,
      select: isMaster
        ? select
        : select?.replace(/[+-]?(coordinates|location|password)/g, ''),
      sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
    })
  }

  @Get(':id')
  @Auth()
  async getOneNote(@Param() params: MongoIdDto) {
    const { id } = params

    const current = await this.noteService.model
      .findOne({
        _id: id,
      })
      .select(`+password +location +coordinates`)
      .lean({ getters: true })
    if (!current) {
      throw new CannotFindException()
    }

    return current
  }

  @Get('/list/:id')
  @ApiOperation({ summary: '以一篇记录为基准的中间 10 篇记录' })
  async getNoteList(
    @Query() query: ListQueryDto,
    @Param() params: MongoIdDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { size = 10 } = query
    const half = size >> 1
    const { id } = params
    const select = 'nid _id title created'
    const condition = isMaster ? {} : { hide: false }

    // 当前文档直接找，不用加条件，反正里面的东西是看不到的
    const currentDocument = await this.noteService.model
      .findById(id)
      .select(select)
      .lean()

    if (!currentDocument) {
      return { data: [], size: 0 }
    }
    const prevList =
      half - 1 === 0
        ? []
        : await this.noteService.model
            .find(
              {
                created: {
                  $gt: currentDocument.created,
                },
                ...condition,
              },
              select,
            )
            .limit(half - 1)
            .sort({ created: 1 })
            .lean()
    const nextList = !half
      ? []
      : await this.noteService.model
          .find(
            {
              created: {
                $lt: currentDocument.created,
              },
              ...condition,
            },
            select,
          )
          .limit(half - 1)
          .sort({ created: -1 })
          .lean()
    const data = [...prevList, ...nextList, currentDocument].sort(
      (a: any, b: any) => b.created - a.created,
    )

    return { data, size: data.length }
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  async create(@Body() body: NoteModel) {
    return await this.noteService.create(body)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: NoteModel, @Param() params: MongoIdDto) {
    return await this.noteService.updateById(params.id, body)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialNoteModel, @Param() params: MongoIdDto) {
    await this.noteService.updateById(params.id, body)
    return
  }

  @Get('like/:id')
  async likeNote(
    @Param() param: IntIdOrMongoIdDto,
    @IpLocation() location: IpRecord,
  ) {
    const id =
      typeof param.id === 'number'
        ? (await this.noteService.model.findOne({ nid: param.id }).lean())?.id
        : param.id
    if (!id) {
      throw new CannotFindException()
    }
    try {
      const res = await this.countingService.updateLikeCount(
        'Note',
        id,
        location.ip,
      )
      if (!res) {
        throw new BadRequestException('你已经喜欢过啦！')
      }
      return
    } catch (e: any) {
      throw new BadRequestException(e)
    }
  }

  @Delete(':id')
  @Auth()
  async deleteNote(@Param() params: MongoIdDto) {
    await this.noteService.deleteById(params.id)
  }

  @Get('/latest')
  @ApiOperation({ summary: '获取最新发布一篇记录' })
  @VisitDocument('Note')
  async getLatestOne(@IsMaster() isMaster: boolean) {
    const { latest, next } = await this.noteService.getLatestOne(
      isMaster ? {} : this.noteService.publicNoteQueryCondition,
      isMaster ? '+location +coordinates' : '-location -coordinates',
    )

    latest.text = this.noteService.checkNoteIsSecret(latest) ? '' : latest.text

    return { data: latest, next }
  }

  // C 端入口
  @Get('/nid/:nid')
  @VisitDocument('Note')
  async getNoteByNid(
    @Param() params: NidType,
    @IsMaster() isMaster: boolean,
    @Query() query: NotePasswordQueryDto,
    @IpLocation() { ip }: IpRecord,
  ) {
    const { nid } = params
    const { password, single: isSingle } = query
    const condition = isMaster ? {} : { hide: false }
    const current: NoteModel | null = await this.noteService.model
      .findOne({
        nid,
        ...condition,
      })
      .select(`+password ${isMaster ? '+location +coordinates' : ''}`)
      .lean({ getters: true })
    if (!current) {
      throw new CannotFindException()
    }

    current.text =
      !isMaster && this.noteService.checkNoteIsSecret(current)
        ? ''
        : await this.macrosService.replaceTextMacro(current.text, current)

    if (
      !this.noteService.checkPasswordToAccess(current, password) &&
      !isMaster
    ) {
      throw new ForbiddenException('不要偷看人家的小心思啦~')
    }

    const liked = await this.countingService
      .getThisRecordIsLiked(current.id!, ip)
      .catch(() => false)

    const currentData = {
      ...current,
      liked,
    }

    if (isSingle) {
      return currentData
    }

    const select = '_id title nid id created modified'

    const prev = await this.noteService.model
      .findOne({
        ...condition,
        created: {
          $gt: current.created,
        },
      })
      .sort({ created: 1 })
      .select(select)
      .lean()
    const next = await this.noteService.model
      .findOne({
        ...condition,
        created: {
          $lt: current.created,
        },
      })
      .sort({ created: -1 })
      .select(select)
      .lean()
    delete current.password
    return { data: currentData, next, prev }
  }

  @Get('/topics/:id')
  @HTTPDecorators.Paginator
  async getNotesByTopic(
    @Param() params: MongoIdDto,
    @Query() query: PagerDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { id } = params
    const {
      size,
      page,
      select = '_id title nid id created modified',
      sortBy,
      sortOrder,
    } = query
    const condition: FilterQuery<NoteModel> = isMaster
      ? { $or: [{ hide: false }, { hide: true }] }
      : { hide: false }

    return await this.noteService.getNotePaginationByTopicId(
      id,
      {
        page,
        limit: size,
        select,
        sort: sortBy ? { [sortBy]: sortOrder } : undefined,
      },
      { ...condition },
    )
  }
}

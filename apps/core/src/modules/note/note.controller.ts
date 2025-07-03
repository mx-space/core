import type { FilterQuery } from 'mongoose'

import {
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

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { addYearCondition } from '~/transformers/db-query.transformer'

import {
  ListQueryDto,
  NidType,
  NotePasswordQueryDto,
  NoteQueryDto,
  SetNotePublishStatusDto,
} from './note.dto'
import { NoteModel, PartialNoteModel } from './note.model'
import { NoteService } from './note.service'

@ApiController({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,

    private readonly macrosService: TextMacroService,
  ) {}

  @Get('/')
  @Paginator
  async getNotes(
    @IsAuthenticated() isAuthenticated: boolean,
    @Query() query: NoteQueryDto,
  ) {
    const { size, select, page, sortBy, sortOrder, year, db_query } = query
    const condition = {
      ...addYearCondition(year),
    }

    if (!isAuthenticated) {
      Object.assign(condition, this.noteService.publicNoteQueryCondition)
    }

    return await this.noteService.model.paginate(db_query ?? condition, {
      limit: size,
      page,
      select: isAuthenticated
        ? select
        : select?.replace(/[+-]?(coordinates|location|password)/g, ''),
      sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
    })
  }

  @Get(':id')
  async getOneNote(
    @Param() params: MongoIdDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
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

    // 非认证用户只能查看已发布的手记
    if (!isAuthenticated && !current.isPublished) {
      throw new CannotFindException()
    }

    return current
  }

  @Get('/list/:id')
  async getNoteList(
    @Query() query: ListQueryDto,
    @Param() params: MongoIdDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { size = 10 } = query
    const half = size >> 1
    const { id } = params
    const select = isAuthenticated
      ? 'nid _id title created isPublished'
      : 'nid _id title created'
    const condition = isAuthenticated ? {} : { isPublished: true }

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
    await this.noteService.updateById(params.id, body)
    return this.noteService.findOneByIdOrNid(params.id)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialNoteModel, @Param() params: MongoIdDto) {
    await this.noteService.updateById(params.id, body)
    return
  }

  @Delete(':id')
  @Auth()
  async deleteNote(@Param() params: MongoIdDto) {
    await this.noteService.deleteById(params.id)
  }

  @Get('/latest')
  async getLatestOne(@IsAuthenticated() isAuthenticated: boolean) {
    const result = await this.noteService.getLatestOne(
      isAuthenticated ? {} : this.noteService.publicNoteQueryCondition,
      isAuthenticated ? '+location +coordinates' : '-location -coordinates',
    )

    if (!result) return null
    const { latest, next } = result
    latest.text = this.noteService.checkNoteIsSecret(latest) ? '' : latest.text

    return { data: latest, next }
  }

  // C 端入口
  @Get('/nid/:nid')
  async getNoteByNid(
    @Param() params: NidType,
    @IsAuthenticated() isAuthenticated: boolean,
    @Query() query: NotePasswordQueryDto,
    @IpLocation() { ip }: IpRecord,
  ) {
    const { nid } = params
    const { password, single: isSingle } = query
    const condition = isAuthenticated ? {} : { isPublished: true }
    const current: NoteModel | null = await this.noteService.model
      .findOne({
        nid,
        ...condition,
      })
      .select(`+password ${isAuthenticated ? '+location +coordinates' : ''}`)
      .lean({ getters: true, autopopulate: true })
    if (!current) {
      throw new CannotFindException()
    }

    current.text =
      !isAuthenticated && this.noteService.checkNoteIsSecret(current)
        ? ''
        : await this.macrosService.replaceTextMacro(current.text, current)

    if (
      !this.noteService.checkPasswordToAccess(current, password) &&
      !isAuthenticated
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
    if (currentData.password) {
      currentData.password = '*'
    }
    return { data: currentData, next, prev }
  }

  @Get('/topics/:id')
  @HTTPDecorators.Paginator
  async getNotesByTopic(
    @Param() params: MongoIdDto,
    @Query() query: PagerDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { id } = params
    const {
      size,
      page,
      select = '_id title nid id created modified',
      sortBy,
      sortOrder,
    } = query
    const condition: FilterQuery<NoteModel> = isAuthenticated
      ? { $or: [{ isPublished: false }, { isPublished: true }] }
      : { isPublished: true }

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

  @Patch('/:id/publish')
  @Auth()
  async setPublishStatus(
    @Param() params: MongoIdDto,
    @Body() body: SetNotePublishStatusDto,
  ) {
    await this.noteService.updateById(params.id, {
      isPublished: body.isPublished,
    })
    return { success: true }
  }
}

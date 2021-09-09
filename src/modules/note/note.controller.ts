import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'
import { Auth } from '~/common/decorator/auth.decorator'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { Paginator } from '~/common/decorator/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { UpdateDocumentCount } from '~/common/decorator/update-count.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { IntIdOrMongoIdDto, MongoIdDto } from '~/shared/dto/id.dto'
import { SearchDto } from '~/shared/dto/search.dto'
import {
  addConditionToSeeHideContent,
  addYearCondition,
} from '~/utils/query.util'
import {
  ListQueryDto,
  NidType,
  NoteQueryDto,
  PasswordQueryDto,
} from './note.dto'
import { NoteModel, PartialNoteModel } from './note.model'
import { NoteService } from './note.service'

@ApiName
@Controller({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,
  ) {}

  @Get('latest')
  @ApiOperation({ summary: '获取最新发布一篇记录' })
  @UpdateDocumentCount('Note')
  async getLatestOne(
    @IsMaster() isMaster: boolean,
    @IpLocation() location: IpRecord,
  ) {
    const { latest, next } = await this.noteService.getLatestOne(
      {
        ...addConditionToSeeHideContent(isMaster),
      },
      isMaster ? '+location +coordinates' : '-location -coordinates',
    )

    return { data: latest.toObject(), next: next.toObject() }
  }

  @Get('/')
  @Paginator
  @ApiOperation({ summary: '获取记录带分页器' })
  async getNotes(@IsMaster() isMaster: boolean, @Query() query: NoteQueryDto) {
    const { size, select, page, sortBy, sortOrder, year } = query
    const condition = {
      ...addConditionToSeeHideContent(isMaster),
      ...addYearCondition(year),
    }
    return await this.noteService.model.paginate(condition, {
      limit: size,
      page,
      select: isMaster
        ? select
        : select?.replace(/[+-]?(coordinates|location|password)/g, ''),
      sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
    })
  }

  @Get(':id')
  @UpdateDocumentCount('Note')
  async getOneNote(
    @Param() params: MongoIdDto,
    @IsMaster() isMaster: boolean,
    @Query() query: PasswordQueryDto,
    @Query('single') isSingle?: boolean,
  ) {
    const { id } = params
    const { password } = query
    const condition = addConditionToSeeHideContent(isMaster)
    const current = await this.noteService.model
      .findOne({
        _id: id,
        ...condition,
      })
      .select('+password ' + (isMaster ? '+location +coordinates' : ''))
    if (!current) {
      throw new CannotFindException()
    }
    if (
      !this.noteService.checkPasswordToAccess(current, password) &&
      !isMaster
    ) {
      throw new ForbiddenException('不要偷看人家的小心思啦~')
    }
    if (isSingle) {
      return current
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

    return { data: current, next, prev }
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
    const condition = addConditionToSeeHideContent(isMaster)
    const currentDocument = await this.noteService.model
      .findOne(
        {
          _id: id,
          ...condition,
        },
        select,
      )
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
            .sort({ created: -1 })
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
  @Auth()
  async create(@Body() body: NoteModel) {
    return await this.noteService.create(body)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: NoteModel, @Param() params: MongoIdDto) {
    await this.noteService.updateById(params.id, body)
    return await this.noteService.model.findById(params.id)
  }

  @Patch('/:id')
  @HttpCode(204)
  @Auth()
  async patch(@Body() body: PartialNoteModel, @Param() params: MongoIdDto) {
    await this.noteService.updateById(params.id, body)
    return
  }

  @Get('like/:id')
  @HttpCode(204)
  async likeNote(
    @Param() param: IntIdOrMongoIdDto,
    @IpLocation() location: IpRecord,
  ) {
    const id =
      typeof param.id === 'number'
        ? (await this.noteService.model.findOne({ nid: param.id }).lean())._id
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
        throw new BadRequestException('你已经喜欢过啦!')
      }
      return
    } catch (e: any) {
      throw new BadRequestException(e)
    }
  }

  @Delete(':id')
  @Auth()
  @HttpCode(204)
  async deleteNote(@Param() params: MongoIdDto) {
    await this.noteService.deleteById(params.id)
  }

  @ApiOperation({ summary: '根据 nid 查找' })
  @Get('/nid/:nid')
  @UpdateDocumentCount('Note')
  async getNoteByNid(
    @Param() params: NidType,
    @IsMaster() isMaster: boolean,
    @Query() query: PasswordQueryDto,
    @Query('single') isSingle?: boolean,
  ) {
    const id = await this.noteService.getIdByNid(params.nid)
    if (!id) {
      throw new CannotFindException()
    }
    return await this.getOneNote({ id }, isMaster, query, isSingle)
  }

  @ApiOperation({ summary: '根据 nid 修改' })
  @Put('/nid/:nid')
  @Auth()
  async modifyNoteByNid(@Param() params: NidType, @Body() body: NoteModel) {
    const id = await this.noteService.getIdByNid(params.nid)
    if (!id) {
      throw new CannotFindException()
    }
    return await this.modify(body, {
      id,
    })
  }

  @ApiOperation({ summary: '搜索' })
  @Get('/search')
  @HttpCache.disable
  @Paginator
  async searchNote(@Query() query: SearchDto, @IsMaster() isMaster: boolean) {
    const { keyword, page, size } = query
    const select = '_id title created modified nid'

    const keywordArr = keyword
      .split(/\s+/)
      .map((item) => new RegExp(String(item), 'ig'))

    return await this.noteService.model.paginate(
      {
        $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
        $and: [
          { password: { $in: [undefined, null] } },
          { hide: { $in: isMaster ? [false, true] : [false] } },
          {
            $or: [
              { secret: { $in: [undefined, null] } },
              { secret: { $lte: new Date() } },
            ],
          },
        ],
      },
      {
        limit: size,
        page,
        select,
      },
    )
  }
}

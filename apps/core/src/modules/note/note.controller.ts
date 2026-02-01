import {
  Body,
  Delete,
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
import { IpLocation } from '~/common/decorators/ip.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { TranslationEnhancerService } from '~/processors/helper/helper.translation-enhancer.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { addYearCondition } from '~/transformers/db-query.transformer'
import type { QueryFilter } from 'mongoose'
import { NoteModel } from './note.model'
import {
  ListQueryDto,
  NidType,
  NoteDto,
  NotePasswordQueryDto,
  NoteQueryDto,
  NoteTopicPagerDto,
  PartialNoteDto,
  SetNotePublishStatusDto,
} from './note.schema'
import { NoteService } from './note.service'

type NoteListItem = {
  _id?: { toString?: () => string } | string
  id?: string
  title: string
  created?: Date
  modified?: Date | null
  text?: string
  isTranslated?: boolean
  translationMeta?: unknown
}

@ApiController({ path: 'notes' })
export class NoteController {
  constructor(
    private readonly noteService: NoteService,
    private readonly countingService: CountingService,

    private readonly macrosService: TextMacroService,
    private readonly translationEnhancerService: TranslationEnhancerService,
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
    @Lang() lang?: string,
  ) {
    const { size = 10 } = query
    const half = size >> 1
    const { id } = params
    const select = 'nid _id title created isPublished modified'
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
    let data = [...prevList, ...nextList, currentDocument] as NoteListItem[]
    data = data.sort(
      (a, b) => (b.created?.valueOf() ?? 0) - (a.created?.valueOf() ?? 0),
    )

    // 处理翻译
    data = await this.translationEnhancerService.translateList({
      items: data,
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => ({
        id: item._id?.toString?.() ?? item.id ?? String(item._id),
        title: item.title,
        modified: item.modified,
        created: item.created,
      }),
      applyResult: (item, translation) => {
        if (translation?.isTranslated) {
          item.title = translation.title
          item.isTranslated = true
          item.translationMeta = translation.translationMeta
        }
        return item
      },
    })

    return { data, size: data.length }
  }

  @Post('/')
  @HTTPDecorators.Idempotence()
  @Auth()
  async create(@Body() body: NoteDto) {
    return await this.noteService.create(body as unknown as NoteModel)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: NoteDto, @Param() params: MongoIdDto) {
    await this.noteService.updateById(params.id, body as unknown as NoteModel)
    return this.noteService.findOneByIdOrNid(params.id)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialNoteDto, @Param() params: MongoIdDto) {
    await this.noteService.updateById(
      params.id,
      body as unknown as Partial<NoteModel>,
    )
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
    @Lang() lang?: string,
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
      throw new BizException(ErrorCodeEnum.NoteForbidden)
    }

    const liked = await this.countingService
      .getThisRecordIsLiked(current.id!, ip)
      .catch(() => false)

    const translationResult =
      await this.translationEnhancerService.enhanceWithTranslation({
        articleId: current.id!,
        targetLang: lang,
        allowHidden: Boolean(isAuthenticated || current.password),
        originalData: {
          title: current.title,
          text: current.text,
        },
      })

    const currentData = {
      ...current,
      title: translationResult.title,
      text: translationResult.text,
      isTranslated: translationResult.isTranslated,
      translationMeta: translationResult.translationMeta,
      availableTranslations: translationResult.availableTranslations,
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
    @Query() query: NoteTopicPagerDto,
    @IsAuthenticated() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const { id } = params
    const {
      size,
      page,
      select = '_id title nid id created modified text',
      sortBy,
      sortOrder,
    } = query
    const condition: QueryFilter<NoteModel> = isAuthenticated
      ? { $or: [{ isPublished: false }, { isPublished: true }] }
      : { isPublished: true }

    const result = await this.noteService.getNotePaginationByTopicId(
      id,
      {
        page,
        limit: size,
        select,
        sort: sortBy ? { [sortBy]: sortOrder } : undefined,
      },
      { ...condition },
    )

    // 处理翻译
    const translatedDocs = await this.translationEnhancerService.translateList({
      items: result.docs as unknown as NoteListItem[],
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item) => ({
        id: item._id?.toString?.() ?? item.id ?? String(item._id),
        title: item.title,
        modified: item.modified,
        created: item.created,
      }),
      applyResult: (item, translation) => {
        delete (item as { text?: string }).text // 始终移除 text
        if (translation?.isTranslated) {
          item.title = translation.title
          item.isTranslated = true
          item.translationMeta = translation.translationMeta
        }
        return item
      },
    })
    result.docs = translatedDocs as typeof result.docs

    return result
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

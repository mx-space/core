import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { DraftRefType } from './draft.model'
import {
  CreateDraftDto,
  DraftPagerDto,
  DraftRefTypeAndIdDto,
  DraftRefTypeDto,
  RestoreVersionDto,
  UpdateDraftDto,
} from './draft.schema'
import { DraftService } from './draft.service'

@ApiController('drafts')
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Post('/')
  @Auth()
  async create(@Body() body: CreateDraftDto) {
    return await this.draftService.create(body)
  }

  @Get('/')
  @Auth()
  async list(@Query() query: DraftPagerDto) {
    const { page, size, refType, hasRef, sortBy, sortOrder } = query

    const filter: Record<string, any> = {}
    if (refType) {
      filter.refType = refType
    }
    if (hasRef !== undefined) {
      filter.refId = hasRef ? { $exists: true } : { $exists: false }
    }

    const [data, total] = await Promise.all([
      this.draftService.model
        .find(filter)
        .sort(sortBy ? { [sortBy]: sortOrder || -1 } : { updated: -1 })
        .skip((page - 1) * size)
        .limit(size)
        .lean({ getters: true }),
      this.draftService.model.countDocuments(filter),
    ])

    // Transform typeSpecificData for each draft
    const transformedData = data.map((d) => {
      if (d.typeSpecificData && typeof d.typeSpecificData === 'string') {
        try {
          ;(d as any).typeSpecificData = JSON.parse(d.typeSpecificData)
        } catch {
          // Keep as is
        }
      }
      return d
    })

    return {
      data: transformedData,
      pagination: {
        total,
        currentPage: page,
        totalPage: Math.ceil(total / size),
        size,
        hasNextPage: page * size < total,
        hasPrevPage: page > 1,
      },
    }
  }

  @Get('/by-ref/:refType/new')
  @Auth()
  async getNewDrafts(@Param() params: DraftRefTypeDto) {
    return await this.draftService.findNewDrafts(params.refType as DraftRefType)
  }

  @Get('/by-ref/:refType/:refId')
  @Auth()
  async getByRef(@Param() params: DraftRefTypeAndIdDto) {
    // 返回 null 表示没有关联草稿，这是正常情况，不是错误
    const draft = await this.draftService.findByRef(
      params.refType as DraftRefType,
      params.refId,
    )
    return draft
  }

  @Get('/:id')
  @Auth()
  async getById(@Param() params: MongoIdDto) {
    const draft = await this.draftService.findById(params.id)
    if (!draft) {
      throw new CannotFindException()
    }
    return draft
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: MongoIdDto, @Body() body: UpdateDraftDto) {
    return await this.draftService.update(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() params: MongoIdDto) {
    await this.draftService.delete(params.id)
    return { success: true }
  }

  @Get('/:id/history')
  @Auth()
  async getHistory(@Param() params: MongoIdDto) {
    return await this.draftService.getHistory(params.id)
  }

  @Get('/:id/history/:version')
  @Auth()
  async getHistoryVersion(
    @Param() params: MongoIdDto,
    @Param() versionParams: RestoreVersionDto,
  ) {
    return await this.draftService.getHistoryVersion(
      params.id,
      versionParams.version,
    )
  }

  @Post('/:id/restore/:version')
  @Auth()
  async restore(
    @Param() params: MongoIdDto,
    @Param() versionParams: RestoreVersionDto,
  ) {
    return await this.draftService.restoreVersion(
      params.id,
      versionParams.version,
    )
  }
}

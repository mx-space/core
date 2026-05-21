import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'

import { DraftRefType } from './draft.enum'
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
    const created = await this.draftService.create(body)
    return created
  }

  @Get('/')
  @Auth()
  async list(@Query() query: DraftPagerDto) {
    const { page, size, refType, hasRef } = query

    const filter: Record<string, any> = {}
    if (refType) filter.refType = refType
    if (hasRef !== undefined) filter.hasRef = hasRef

    const result = await this.draftService.list(page, size, filter)
    const data = result.data.map((d) => {
      if (typeof d.typeSpecificData === 'string') {
        try {
          ;(d as any).typeSpecificData = JSON.parse(d.typeSpecificData)
        } catch {
          // keep raw payload
        }
      }
      return d
    })

    return withMeta(
      data,
      new MetaObjectBuilder()
        .view('card')
        .pagination({
          page: result.pagination.currentPage,
          size: result.pagination.size,
          total: result.pagination.total,
          total_pages: result.pagination.totalPage,
        })
        .build(),
    )
  }

  @Get('/by-ref/:refType/new')
  @Auth()
  async getNewDrafts(@Param() params: DraftRefTypeDto) {
    const data = await this.draftService.findNewDrafts(
      params.refType as DraftRefType,
    )
    return data
  }

  @Get('/by-ref/:refType/:refId')
  @Auth()
  async getByRef(@Param() params: DraftRefTypeAndIdDto) {
    const draft = await this.draftService.findByRef(
      params.refType as DraftRefType,
      params.refId,
    )
    return draft
  }

  @Get('/:id')
  @Auth()
  async getById(@Param() params: EntityIdDto) {
    const draft = await this.draftService.findById(params.id)
    if (!draft) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id: params.id })
    }
    return draft
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: EntityIdDto, @Body() body: UpdateDraftDto) {
    const updated = await this.draftService.update(params.id, body)
    return updated
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() params: EntityIdDto) {
    await this.draftService.delete(params.id)
    return { success: true }
  }

  @Get('/:id/history')
  @Auth()
  async getHistory(@Param() params: EntityIdDto) {
    const data = await this.draftService.getHistory(params.id)
    return data
  }

  @Get('/:id/history/:version')
  @Auth()
  async getHistoryVersion(
    @Param() params: EntityIdDto,
    @Param() versionParams: RestoreVersionDto,
  ) {
    const data = await this.draftService.getHistoryVersion(
      params.id,
      versionParams.version,
    )
    return data
  }

  @Post('/:id/restore/:version')
  @Auth()
  async restore(
    @Param() params: EntityIdDto,
    @Param() versionParams: RestoreVersionDto,
  ) {
    const data = await this.draftService.restoreVersion(
      params.id,
      versionParams.version,
    )
    return data
  }
}

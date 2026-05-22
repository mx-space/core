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
  create(@Body() body: CreateDraftDto) {
    return this.draftService.create(body)
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
          totalPages: result.pagination.totalPage,
        })
        .build(),
    )
  }

  @Get('/by-ref/:refType/new')
  @Auth()
  getNewDrafts(@Param() params: DraftRefTypeDto) {
    return this.draftService.findNewDrafts(params.refType as DraftRefType)
  }

  @Get('/by-ref/:refType/:refId')
  @Auth()
  getByRef(@Param() params: DraftRefTypeAndIdDto) {
    return this.draftService.findByRef(
      params.refType as DraftRefType,
      params.refId,
    )
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
  update(@Param() params: EntityIdDto, @Body() body: UpdateDraftDto) {
    return this.draftService.update(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param() params: EntityIdDto) {
    await this.draftService.delete(params.id)
    return { success: true }
  }

  @Get('/:id/history')
  @Auth()
  getHistory(@Param() params: EntityIdDto) {
    return this.draftService.getHistory(params.id)
  }

  @Get('/:id/history/:version')
  @Auth()
  getHistoryVersion(
    @Param() params: EntityIdDto,
    @Param() versionParams: RestoreVersionDto,
  ) {
    return this.draftService.getHistoryVersion(params.id, versionParams.version)
  }

  @Post('/:id/restore/:version')
  @Auth()
  restore(
    @Param() params: EntityIdDto,
    @Param() versionParams: RestoreVersionDto,
  ) {
    return this.draftService.restoreVersion(params.id, versionParams.version)
  }
}

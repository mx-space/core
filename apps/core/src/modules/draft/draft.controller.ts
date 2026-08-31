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
  RevisionComparisonDto,
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
    const result = await this.draftService.list(query.page, query.size, {
      hasRef: query.hasRef,
      refType: query.refType,
      search: query.search,
    })
    return withMeta(
      result.data,
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

  @Get('/context/:refType/:refId')
  @Auth()
  context(@Param() params: DraftRefTypeAndIdDto) {
    return this.draftService.getContext(
      params.refType as DraftRefType,
      params.refId,
    )
  }

  @Get('/new/:refType')
  @Auth()
  getNewDrafts(@Param() params: DraftRefTypeDto) {
    return this.draftService.findNewDrafts(params.refType as DraftRefType)
  }

  @Get('/compare/:leftId/:rightId')
  @Auth()
  compare(@Param() params: RevisionComparisonDto) {
    return this.draftService.compare(params.leftId, params.rightId)
  }

  @Get('/revisions/:id')
  @Auth()
  revision(@Param() params: EntityIdDto) {
    return this.draftService.findRevisionById(params.id)
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

  @Get('/:id/revisions')
  @Auth()
  revisions(@Param() params: EntityIdDto) {
    return this.draftService.getBranchRevisions(params.id)
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
}

import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'

import { DraftRefType } from './draft.enum'
import {
  type CreateDraftDto,
  CreateDraftSchema,
  type DraftDocumentIdDto,
  DraftDocumentIdSchema,
  type DraftPagerDto,
  DraftPagerSchema,
  type DraftRefTypeAndIdDto,
  DraftRefTypeAndIdSchema,
  type DraftRefTypeDto,
  DraftRefTypeSchema,
  type DraftShareTokenDto,
  DraftShareTokenSchema,
  type RevisionComparisonDto,
  RevisionComparisonSchema,
  type SetDraftShareDto,
  SetDraftShareSchema,
  type UpdateDraftDto,
  UpdateDraftSchema,
} from './draft.schema'
import { DraftService } from './draft.service'
import { DraftViews } from './draft.views'

@ApiController('drafts')
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Post('/')
  @Auth()
  create(@Body({ schema: CreateDraftSchema }) body: CreateDraftDto) {
    return this.draftService.create(body)
  }

  @Get('/')
  @Auth()
  async list(@Query({ schema: DraftPagerSchema }) query: DraftPagerDto) {
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
  context(
    @Param({ schema: DraftRefTypeAndIdSchema }) params: DraftRefTypeAndIdDto,
  ) {
    return this.draftService.getContext(
      params.refType as DraftRefType,
      params.refId,
    )
  }

  @Get('/new/:refType')
  @Auth()
  getNewDrafts(@Param({ schema: DraftRefTypeSchema }) params: DraftRefTypeDto) {
    return this.draftService.findNewDrafts(params.refType as DraftRefType)
  }

  @Get('/shared/:token')
  async shared(
    @Param({ schema: DraftShareTokenSchema }) params: DraftShareTokenDto,
  ) {
    const snapshot = await this.draftService.findSharedSnapshot(params.token)
    return DraftViews.shared.parse(snapshot)
  }

  @Get('/documents/:documentId/share')
  @Auth()
  getShare(
    @Param({ schema: DraftDocumentIdSchema }) params: DraftDocumentIdDto,
  ) {
    return this.draftService.getShare(params.documentId)
  }

  @Put('/documents/:documentId/share')
  @Auth()
  setShare(
    @Param({ schema: DraftDocumentIdSchema }) params: DraftDocumentIdDto,
    @Body({ schema: SetDraftShareSchema }) body: SetDraftShareDto,
  ) {
    return this.draftService.setShare(params.documentId, body)
  }

  @Delete('/documents/:documentId/share')
  @Auth()
  async deleteShare(
    @Param({ schema: DraftDocumentIdSchema }) params: DraftDocumentIdDto,
  ) {
    await this.draftService.deleteShare(params.documentId)
    return { success: true }
  }

  @Get('/compare/:leftId/:rightId')
  @Auth()
  compare(
    @Param({ schema: RevisionComparisonSchema }) params: RevisionComparisonDto,
  ) {
    return this.draftService.compare(params.leftId, params.rightId)
  }

  @Get('/revisions/:id')
  @Auth()
  revision(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.draftService.findRevisionById(params.id)
  }

  @Get('/:id')
  @Auth()
  async getById(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    const draft = await this.draftService.findById(params.id)
    if (!draft) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, { id: params.id })
    }
    return draft
  }

  @Get('/:id/revisions')
  @Auth()
  revisions(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.draftService.getBranchRevisions(params.id)
  }

  @Put('/:id')
  @Auth()
  update(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateDraftSchema }) body: UpdateDraftDto,
  ) {
    return this.draftService.update(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  async delete(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    await this.draftService.delete(params.id)
    return { success: true }
  }
}

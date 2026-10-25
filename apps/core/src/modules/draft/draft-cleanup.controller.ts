import { Body, Get, Param, Post, Query } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'

import {
  type BatchDeleteDraftsDto,
  BatchDeleteDraftsSchema,
  type CleanupPreviewQueryDto,
  CleanupPreviewQuerySchema,
  type CleanupRunDto,
  CleanupRunSchema,
  type OrganizeDraftsDto,
  OrganizeDraftsSchema,
  type OrganizerPreviewQueryDto,
  OrganizerPreviewQuerySchema,
  OrganizerPreviewView,
  OrganizerResultView,
  type StorageQueryDto,
  StorageQuerySchema,
} from './draft-cleanup.schema'
import { DraftCleanupService } from './draft-cleanup.service'

@ApiController('drafts')
export class DraftCleanupController {
  constructor(private readonly cleanup: DraftCleanupService) {}

  @Get('/organize/preview')
  @Auth()
  async organizerPreview(
    @Query({ schema: OrganizerPreviewQuerySchema })
    query: OrganizerPreviewQueryDto,
  ) {
    return OrganizerPreviewView.parse(
      await this.cleanup.organizerPreview(query),
    )
  }

  @Post('/organize')
  @Auth()
  async organize(
    @Body({ schema: OrganizeDraftsSchema }) body: OrganizeDraftsDto,
  ) {
    return OrganizerResultView.parse(await this.cleanup.organize(body))
  }

  @Get('/storage')
  @Auth()
  storage(@Query({ schema: StorageQuerySchema }) query: StorageQueryDto) {
    return this.cleanup.storage(query.refType)
  }

  @Get('/cleanup/preview')
  @Auth()
  preview(
    @Query({ schema: CleanupPreviewQuerySchema }) query: CleanupPreviewQueryDto,
  ) {
    return this.cleanup.preview(query.olderThanDays)
  }

  @Post('/cleanup')
  @Auth()
  run(@Body({ schema: CleanupRunSchema }) body: CleanupRunDto) {
    return this.cleanup.run(body)
  }

  @Post('/batch-delete')
  @Auth()
  batchDelete(
    @Body({ schema: BatchDeleteDraftsSchema }) body: BatchDeleteDraftsDto,
  ) {
    return this.cleanup.deleteDrafts(body.ids)
  }

  @Get('/:id/compact/preview')
  @Auth()
  compactPreview(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.cleanup.compactPreview(params.id)
  }

  @Post('/:id/compact')
  @Auth()
  compact(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.cleanup.compact(params.id)
  }
}

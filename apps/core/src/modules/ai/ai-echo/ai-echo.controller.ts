import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import type { SessionUser } from '~/modules/auth/auth.types'
import { EntityIdDto } from '~/shared/dto/id.dto'

import {
  AdminListEchoQueryDto,
  EditEchoDto,
  RegenerateEchoDto,
  SubjectParamsDto,
} from './ai-echo.schema'
import { AiEchoService } from './ai-echo.service'
import type { AiEcho } from './ai-echo.types'
import {
  type AiEchoAdminView,
  type AiEchoPublicView,
  AiEchoViews,
} from './ai-echo.views'

@ApiController('ai-echo')
export class AiEchoController {
  constructor(private readonly service: AiEchoService) {}

  @Get('/by-subject/:subjectType/:subjectId')
  async listBySubject(
    @Param() params: SubjectParamsDto,
    @Query('personaKey') personaKey?: string,
    @Query('scenarioKey') scenarioKey?: string,
  ) {
    const rows = await this.service.listPublicBySubject(
      scenarioKey ?? params.subjectType,
      params.subjectType,
      params.subjectId,
      personaKey,
    )
    return rows.map((row) => this.toPublicView(row))
  }

  @Get('/')
  @Auth()
  async adminList(@Query() query: AdminListEchoQueryDto) {
    const result = await this.service.adminList(query)
    return withMeta(
      result.data.map((row) => this.toAdminView(row)),
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Post('/regenerate/:subjectType/:subjectId')
  @Auth()
  async regenerate(
    @Param() params: SubjectParamsDto,
    @Body() body: RegenerateEchoDto,
    @Query('scenarioKey') scenarioKey?: string,
  ) {
    return this.service.regenerate(
      params.subjectType,
      params.subjectId,
      body.personaKey,
      body.force ?? false,
      scenarioKey,
    )
  }

  @Put('/:id')
  @Auth()
  async edit(
    @Param() params: EntityIdDto,
    @Body() body: EditEchoDto,
    @CurrentUser() user: SessionUser,
  ) {
    const row = await this.service.edit(params.id, body.content, user.id)
    return this.toAdminView(row)
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async delete(@Param() params: EntityIdDto) {
    await this.service.softDelete(params.id)
  }

  private toPublicView(row: AiEcho): AiEchoPublicView {
    return AiEchoViews.public.parse({
      id: row.id,
      scenarioKey: row.scenarioKey,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      personaKey: row.personaKey,
      content: row.content,
      status: row.status,
      generatedAt: row.generatedAt,
      editedAt: row.editedAt,
      metadata: {
        profileRefreshedAt: row.metadata.profileRefreshedAt,
        retrievalIds: row.metadata.retrievalIds,
        memoryIds: row.metadata.memoryIds,
      },
    })
  }

  private toAdminView(row: AiEcho): AiEchoAdminView {
    return AiEchoViews.admin.parse({
      id: row.id,
      scenarioKey: row.scenarioKey,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      personaKey: row.personaKey,
      content: row.content,
      status: row.status,
      model: row.model,
      metadata: row.metadata,
      generatedAt: row.generatedAt,
      editedAt: row.editedAt,
      editedBy: row.editedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
